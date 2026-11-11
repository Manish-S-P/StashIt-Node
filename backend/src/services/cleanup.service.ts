import { BURN_WINDOW_MS, PENDING_UPLOAD_TTL_MS } from '../config/limits.js';
import { logger } from '../lib/logger.js';
import { deleteObject, deletePrefix, objectKey, stashPrefix } from '../lib/storage.js';
import { Stash, type StashDoc } from '../models/stash.model.js';
import { releaseFile } from './file.service.js';

const BATCH = 200;

/** Deletes a stash completely: files in storage first, then the database record. */
export async function purgeStash(stashId: StashDoc['_id']): Promise<void> {
  await deletePrefix(stashPrefix(String(stashId)));
  await Stash.deleteOne({ _id: stashId });
}

export interface CleanupResult {
  purgedStashes: number;
  releasedUploads: number;
}

/**
 * Runs every few minutes. Safe to run twice at once or to crash halfway:
 * every step can simply be repeated on the next run.
 */
export async function runCleanup(now = new Date()): Promise<CleanupResult> {
  let purgedStashes = 0;
  let releasedUploads = 0;

  // 1. Expired stashes, and burned stashes whose download window has passed.
  const dead = await Stash.find(
    {
      $or: [
        { expiresAt: { $lte: now } },
        { burnedAt: { $lte: new Date(now.getTime() - BURN_WINDOW_MS) } },
      ],
    },
    { _id: 1 },
  )
    .limit(BATCH)
    .lean();

  for (const { _id } of dead) {
    try {
      await purgeStash(_id);
      purgedStashes++;
    } catch (err) {
      logger.error({ err, stashId: String(_id) }, 'failed to purge stash');
    }
  }

  // 2. Uploads that reserved space but were never confirmed.
  const cutoff = new Date(now.getTime() - PENDING_UPLOAD_TTL_MS);
  const withStale = await Stash.find(
    { files: { $elemMatch: { status: 'pending', createdAt: { $lte: cutoff } } } },
    { files: 1 },
  )
    .limit(BATCH)
    .lean<Pick<StashDoc, '_id' | 'files'>[]>();

  for (const stash of withStale) {
    for (const file of stash.files) {
      if (file.status !== 'pending' || file.createdAt > cutoff) continue;
      try {
        await deleteObject(objectKey(String(stash._id), file.fileId));
        if (await releaseFile(stash._id, file.fileId, file.size)) releasedUploads++;
      } catch (err) {
        logger.error({ err, fileId: file.fileId }, 'failed to release stale upload');
      }
    }
  }

  return { purgedStashes, releasedUploads };
}
