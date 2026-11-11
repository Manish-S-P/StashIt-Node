import { describe, expect, it } from 'vitest';
import { BURN_WINDOW_MS, PENDING_UPLOAD_TTL_MS } from '../src/config/limits.js';
import { objectKey, objectSize } from '../src/lib/storage.js';
import { Stash } from '../src/models/stash.model.js';
import { runCleanup } from '../src/services/cleanup.service.js';
import { normalizeTitle } from '../src/services/stash.service.js';
import { api, auth, createStash, uploadFile, useTestDb } from './helpers.js';

useTestDb();

const findByTitle = (title: string) => Stash.findOne({ titleKey: normalizeTitle(title) }).lean();

describe('cleanup job', () => {
  it('deletes expired stashes and their files', async () => {
    const { token, title } = await createStash();
    const { fileId } = await uploadFile(token, 'old.txt', Buffer.from('old data'));
    const stash = await findByTitle(title);
    const key = objectKey(String(stash!._id), fileId);
    expect(await objectSize(key)).toBe(8);

    await Stash.updateOne({ _id: stash!._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await runCleanup();

    expect(await findByTitle(title)).toBeNull();
    expect(await objectSize(key)).toBeNull();
  });

  it('keeps stashes that have not expired', async () => {
    const { title } = await createStash();
    await runCleanup();
    expect(await findByTitle(title)).not.toBeNull();
  });

  it('deletes a burned stash after the burn window', async () => {
    const { token, title } = await createStash({ burnAfterRead: true });
    await uploadFile(token, 'once.txt', Buffer.from('read once'));
    const stash = await findByTitle(title);

    await Stash.updateOne(
      { _id: stash!._id },
      { $set: { burnedAt: new Date(Date.now() - BURN_WINDOW_MS - 1000), burnHolder: 'someone' } },
    );
    await runCleanup();
    expect(await findByTitle(title)).toBeNull();
  });

  it('releases uploads that were never confirmed', async () => {
    const { token, title } = await createStash();
    await api().post('/api/stash/files/upload-url').set(auth(token)).send({ name: 'abandoned.bin', size: 500 });

    const stash = await findByTitle(title);
    expect(stash!.totalSize).toBe(500);

    await Stash.updateOne(
      { _id: stash!._id },
      { $set: { 'files.0.createdAt': new Date(Date.now() - PENDING_UPLOAD_TTL_MS - 1000) } },
    );
    const result = await runCleanup();
    expect(result.releasedUploads).toBeGreaterThanOrEqual(1);

    const after = await findByTitle(title);
    expect(after!.files).toHaveLength(0);
    expect(after!.totalSize).toBe(0);
  });
});
