import { describe, expect, it } from 'vitest';
import { config } from '../src/config/env.js';
import { objectKey, objectSize } from '../src/lib/storage.js';
import { Stash } from '../src/models/stash.model.js';
import { normalizeTitle } from '../src/services/stash.service.js';
import { PASSWORD, api, auth, createStash, uploadFile, useTestDb } from './helpers.js';

useTestDb();

const MB = 1024 * 1024;

async function stashIdFor(title: string) {
  const doc = await Stash.findOne({ titleKey: normalizeTitle(title) }, { _id: 1 }).lean();
  return String(doc?._id);
}

describe('uploading, downloading and deleting files', () => {
  it('runs the whole flow', async () => {
    const { token, title } = await createStash();
    const content = Buffer.from('hello from stashit\n');

    const { fileId, stash } = await uploadFile(token, 'hello.txt', content);
    expect(stash.files).toHaveLength(1);
    expect(stash.files[0]).toMatchObject({ id: fileId, name: 'hello.txt', size: content.length });
    expect(stash.usedBytes).toBe(content.length);

    // Another visitor opens the stash and downloads the file.
    const unlock = await api().post('/api/stashes/unlock').send({ title, password: PASSWORD });
    const link = await api().get(`/api/stash/files/${fileId}/download-url`).set(auth(unlock.body.token));
    expect(link.status).toBe(200);

    const download = await fetch(link.body.url);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toContain('attachment');
    expect(Buffer.from(await download.arrayBuffer()).equals(content)).toBe(true);

    // Delete it.
    const del = await api().delete(`/api/stash/files/${fileId}`).set(auth(token));
    expect(del.status).toBe(204);

    const after = await api().get('/api/stash').set(auth(token));
    expect(after.body.stash.files).toEqual([]);
    expect(after.body.stash.usedBytes).toBe(0);
    expect(await objectSize(objectKey(await stashIdFor(title), fileId))).toBeNull();
  });

  it('keeps unusual file names intact on download', async () => {
    const { token } = await createStash();
    const name = 'résumé (final) "v2".txt';
    const { fileId } = await uploadFile(token, name, Buffer.from('cv'));
    const link = await api().get(`/api/stash/files/${fileId}/download-url`).set(auth(token));
    const download = await fetch(link.body.url);
    expect(download.headers.get('content-disposition')).toContain(encodeURIComponent('résumé'));
  });

  it('does not list a file until its upload is confirmed', async () => {
    const { token } = await createStash();
    const ticket = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'pending.bin', size: 10 });
    expect(ticket.status).toBe(201);

    const res = await api().get('/api/stash').set(auth(token));
    expect(res.body.stash.files).toEqual([]);
    expect(res.body.stash.usedBytes).toBe(10); // the space is reserved
  });

  it('rejects an upload whose real size differs from the announced size', async () => {
    const { token } = await createStash();
    const ticket = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'liar.txt', size: 100, contentType: 'text/plain' });

    await fetch(ticket.body.uploadUrl, {
      method: 'PUT',
      headers: ticket.body.headers,
      body: Buffer.from('only 21 bytes, not 100'),
    });

    const confirm = await api().post(`/api/stash/files/${ticket.body.fileId}/confirm`).set(auth(token));
    expect(confirm.status).toBe(400);
    expect(confirm.body.error.code).toBe('UPLOAD_MISMATCH');

    const res = await api().get('/api/stash').set(auth(token));
    expect(res.body.stash.usedBytes).toBe(0); // reserved space was given back
  });

  it('rejects confirming an upload that never happened', async () => {
    const { token } = await createStash();
    const ticket = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'ghost.txt', size: 5 });
    const confirm = await api().post(`/api/stash/files/${ticket.body.fileId}/confirm`).set(auth(token));
    expect(confirm.status).toBe(400);
  });

  it('enforces the size limit per stash', async () => {
    const { token } = await createStash();
    const tooBig = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'huge.iso', size: config.maxStashBytes + 1 });
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('FILE_TOO_LARGE');

    const first = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'a.bin', size: 60 * MB });
    expect(first.status).toBe(201);

    const second = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'b.bin', size: 60 * MB });
    expect(second.status).toBe(413);
    expect(second.body.error.code).toBe('STASH_FULL');
  });

  it('never goes over the limit when uploads arrive at the same time', async () => {
    const { token } = await createStash();
    const size = 30 * MB; // 3 fit in 100 MB, the 4th and 5th must fail
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        api().post('/api/stash/files/upload-url').set(auth(token)).send({ name: `part-${i}.bin`, size }),
      ),
    );
    const accepted = results.filter((r) => r.status === 201).length;
    expect(accepted).toBe(3);

    const res = await api().get('/api/stash').set(auth(token));
    expect(res.body.stash.usedBytes).toBe(3 * size);
  });

  it('enforces the number of files per stash', async () => {
    const { token } = await createStash();
    for (let i = 0; i < config.MAX_FILES_PER_STASH; i++) {
      const res = await api()
        .post('/api/stash/files/upload-url')
        .set(auth(token))
        .send({ name: `f${i}.txt`, size: 1 });
      expect(res.status).toBe(201);
    }
    const oneMore = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(token))
      .send({ name: 'extra.txt', size: 1 });
    expect(oneMore.status).toBe(409);
    expect(oneMore.body.error.code).toBe('TOO_MANY_FILES');
  });

  it('returns 404 for a file that is not in the stash', async () => {
    const { token } = await createStash();
    const res = await api().get('/api/stash/files/does-not-exist/download-url').set(auth(token));
    expect(res.status).toBe(404);
  });
});

describe('burn after read', () => {
  it('lets only the first downloader keep access', async () => {
    const { token: creatorToken, title } = await createStash({ burnAfterRead: true });
    const { fileId } = await uploadFile(creatorToken, 'secret.txt', Buffer.from('top secret'));

    const alice = (await api().post('/api/stashes/unlock').send({ title, password: PASSWORD })).body.token;
    const bob = (await api().post('/api/stashes/unlock').send({ title, password: PASSWORD })).body.token;

    // Alice and Bob click download at the same instant: exactly one wins.
    const [a, b] = await Promise.all([
      api().get(`/api/stash/files/${fileId}/download-url`).set(auth(alice)),
      api().get(`/api/stash/files/${fileId}/download-url`).set(auth(bob)),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 410]);

    const winner = a.status === 200 ? alice : bob;
    const loser = a.status === 200 ? bob : alice;

    // The winner can keep downloading during the burn window.
    const again = await api().get(`/api/stash/files/${fileId}/download-url`).set(auth(winner));
    expect(again.status).toBe(200);
    const view = await api().get('/api/stash').set(auth(winner));
    expect(view.body.stash.burned).toBe(true);
    expect(view.body.stash.burnDeletesAt).toEqual(expect.any(String));

    // Everyone else is locked out, and the stash can't be opened again.
    expect((await api().get('/api/stash').set(auth(loser))).status).toBe(410);
    expect((await api().get('/api/stash').set(auth(creatorToken))).status).toBe(410);
    expect((await api().post('/api/stashes/unlock').send({ title, password: PASSWORD })).status).toBe(401);

    // No new uploads into a burned stash.
    const upload = await api()
      .post('/api/stash/files/upload-url')
      .set(auth(winner))
      .send({ name: 'late.txt', size: 3 });
    expect(upload.status).toBe(410);
  });
});
