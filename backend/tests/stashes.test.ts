import { describe, expect, it } from 'vitest';
import { Stash } from '../src/models/stash.model.js';
import { normalizeTitle } from '../src/services/stash.service.js';
import { PASSWORD, api, auth, createStash, uniqueTitle, useTestDb } from './helpers.js';

useTestDb();

describe('health', () => {
  it('reports ok when the database is up', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });
});

describe('creating a stash', () => {
  it('creates a stash and returns a token and the stash', async () => {
    const title = uniqueTitle('notes');
    const res = await api().post('/api/stashes').send({ title, password: PASSWORD, expiresInMinutes: 60 });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.stash).toMatchObject({ title, files: [], usedBytes: 0, burnAfterRead: false, burned: false });
    expect(res.body.stash).not.toHaveProperty('passwordHash');

    const expiresInMs = new Date(res.body.stash.expiresAt).getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(59 * 60 * 1000);
    expect(expiresInMs).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('stores only a hash of the password', async () => {
    const { title } = await createStash();
    const doc = await Stash.findOne({ titleKey: normalizeTitle(title) }).lean();
    expect(doc?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(doc?.passwordHash).not.toContain(PASSWORD);
  });

  it('rejects a title that is already taken, ignoring case and extra spaces', async () => {
    const { title } = await createStash();
    const res = await api()
      .post('/api/stashes')
      .send({ title: `  ${title.toUpperCase()} `, password: 'another-password' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TITLE_TAKEN');
  });

  it('lets only one of two simultaneous creates with the same title succeed', async () => {
    const title = uniqueTitle('race');
    const [a, b] = await Promise.all([
      api().post('/api/stashes').send({ title, password: PASSWORD }),
      api().post('/api/stashes').send({ title, password: PASSWORD }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
  });

  it('validates the input', async () => {
    const shortPassword = await api().post('/api/stashes').send({ title: uniqueTitle(), password: '123' });
    expect(shortPassword.status).toBe(422);
    expect(shortPassword.body.error.code).toBe('VALIDATION_ERROR');

    for (const expiresInMinutes of [0, 7 * 24 * 60 + 1, 1.5, '60']) {
      const badExpiry = await api()
        .post('/api/stashes')
        .send({ title: uniqueTitle(), password: PASSWORD, expiresInMinutes });
      expect(badExpiry.status).toBe(422);
    }

    const shortTitle = await api().post('/api/stashes').send({ title: 'ab', password: PASSWORD });
    expect(shortTitle.status).toBe(422);
  });

  it('accepts any expiry from 1 minute to 7 days', async () => {
    for (const minutes of [1, 7 * 24 * 60]) {
      const { body } = await createStash({ expiresInMinutes: minutes });
      const ms = new Date(body.stash.expiresAt).getTime() - Date.now();
      expect(ms).toBeGreaterThan((minutes - 1) * 60_000);
      expect(ms).toBeLessThanOrEqual(minutes * 60_000);
    }
  });

  it('frees the title of an expired stash', async () => {
    const { title } = await createStash();
    await Stash.updateOne({ titleKey: normalizeTitle(title) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await api().post('/api/stashes').send({ title, password: 'a-new-password' });
    expect(res.status).toBe(201);
  });
});

describe('opening a stash', () => {
  it('opens with the right password', async () => {
    const { title } = await createStash();
    const res = await api().post('/api/stashes/unlock').send({ title: title.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.stash.title).toBe(title);
  });

  it('gives the same error for a wrong password and an unknown title', async () => {
    const { title } = await createStash();
    const wrongPassword = await api().post('/api/stashes/unlock').send({ title, password: 'nope-nope' });
    const unknownTitle = await api()
      .post('/api/stashes/unlock')
      .send({ title: uniqueTitle('missing'), password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownTitle.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownTitle.body);
  });

  it('locks the stash after 5 wrong passwords, even for the right password', async () => {
    const { title } = await createStash();
    for (let i = 0; i < 5; i++) {
      const res = await api().post('/api/stashes/unlock').send({ title, password: `wrong-${i}-guess` });
      expect(res.status).toBe(401);
    }
    const locked = await api().post('/api/stashes/unlock').send({ title, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('STASH_LOCKED');
  });

  it('resets the wrong-password counter after a correct password', async () => {
    const { title } = await createStash();
    for (let i = 0; i < 4; i++) {
      await api().post('/api/stashes/unlock').send({ title, password: `wrong-${i}-guess` });
    }
    expect((await api().post('/api/stashes/unlock').send({ title, password: PASSWORD })).status).toBe(200);
    expect((await api().post('/api/stashes/unlock').send({ title, password: 'wrong-again' })).status).toBe(401);
    expect((await api().post('/api/stashes/unlock').send({ title, password: PASSWORD })).status).toBe(200);
  });
});

describe('reading and updating a stash', () => {
  it('requires a valid token', async () => {
    expect((await api().get('/api/stash')).status).toBe(401);
    expect((await api().get('/api/stash').set(auth('not-a-real-token'))).status).toBe(401);
  });

  it('returns the stash for its token', async () => {
    const { token, title } = await createStash();
    const res = await api().get('/api/stash').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.stash.title).toBe(title);
  });

  it('changes the expiry', async () => {
    const { token } = await createStash({ expiresInMinutes: 60 });
    const res = await api().patch('/api/stash').set(auth(token)).send({ expiresInMinutes: 7 * 24 * 60 });
    expect(res.status).toBe(200);
    const days = (new Date(res.body.stash.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.99);
  });

  it('treats an expired stash as gone', async () => {
    const { token, title } = await createStash();
    await Stash.updateOne({ titleKey: normalizeTitle(title) }, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await api().get('/api/stash').set(auth(token));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('STASH_NOT_FOUND');

    const unlock = await api().post('/api/stashes/unlock').send({ title, password: PASSWORD });
    expect(unlock.status).toBe(401);
  });
});
