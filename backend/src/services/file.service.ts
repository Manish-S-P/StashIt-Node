import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { UPLOAD_URL_TTL_SECONDS } from '../config/limits.js';
import { AppError, fileNotFound, stashBurned, stashGone } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  objectKey,
  objectSize,
} from '../lib/storage.js';
import { Stash, type StashDoc } from '../models/stash.model.js';
import type { UploadUrlInput } from '../schemas/stash.schemas.js';

const MB = 1024 * 1024;

/** Accept "type/subtype" and drop parameters like "; charset=utf-8". Anything odd becomes a generic binary type. */
export function normalizeContentType(contentType: string | undefined): string {
  const base = (contentType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  return /^[a-z0-9][\w.+-]*\/[\w.+-]+$/.test(base) ? base : 'application/octet-stream';
}

/**
 * Step 1 of an upload: reserve space in the stash and hand back a presigned URL.
 * The reservation is ONE atomic MongoDB update, so two uploads at the same moment
 * can never push the stash past its size or file limit.
 */
export async function requestUpload(stash: StashDoc, input: UploadUrlInput) {
  if (stash.burnedAt) throw stashBurned();
  if (input.size > config.maxStashBytes) {
    throw new AppError(413, 'FILE_TOO_LARGE', `Files can be at most ${config.MAX_STASH_MB} MB`);
  }

  const fileId = randomUUID();
  const contentType = normalizeContentType(input.contentType);
  const now = new Date();
  const lastAllowedIndex = config.MAX_FILES_PER_STASH - 1;

  const result = await Stash.updateOne(
    {
      _id: stash._id,
      burnedAt: null,
      expiresAt: { $gt: now },
      // Only matches if there is room for this file...
      totalSize: { $lte: config.maxStashBytes - input.size },
      // ...and the files array has fewer than MAX_FILES entries.
      [`files.${lastAllowedIndex}`]: { $exists: false },
    },
    {
      $inc: { totalSize: input.size },
      $push: {
        files: {
          fileId,
          name: input.name,
          size: input.size,
          contentType,
          status: 'pending',
          createdAt: now,
        },
      },
    },
  );

  if (result.modifiedCount === 0) {
    // Find out which condition failed, to give a helpful error.
    const fresh = await Stash.findById(stash._id).lean<StashDoc>();
    if (!fresh || fresh.expiresAt <= now) throw stashGone();
    if (fresh.burnedAt) throw stashBurned();
    if (fresh.files.length >= config.MAX_FILES_PER_STASH) {
      throw new AppError(
        409,
        'TOO_MANY_FILES',
        `A stash can hold at most ${config.MAX_FILES_PER_STASH} files`,
      );
    }
    const freeMb = Math.max(0, config.maxStashBytes - fresh.totalSize) / MB;
    throw new AppError(
      413,
      'STASH_FULL',
      `Not enough space: ${freeMb.toFixed(1)} MB left of ${config.MAX_STASH_MB} MB`,
    );
  }

  const uploadUrl = await createUploadUrl(objectKey(String(stash._id), fileId), contentType);
  return {
    fileId,
    uploadUrl,
    method: 'PUT' as const,
    headers: { 'Content-Type': contentType },
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  };
}

/**
 * Step 2 of an upload: the browser says "done". We check the REAL size in storage,
 * because the browser could have uploaded something different from what it declared.
 */
export async function confirmUpload(stash: StashDoc, fileId: string) {
  const file = stash.files.find((f) => f.fileId === fileId);
  if (!file) throw fileNotFound();
  if (file.status === 'ready') return; // Already confirmed: confirming twice is harmless.

  const key = objectKey(String(stash._id), fileId);
  const actualSize = await objectSize(key);

  if (actualSize !== file.size) {
    await deleteObject(key).catch((err) => logger.warn({ err, key }, 'could not delete bad upload'));
    await releaseFile(stash._id, fileId, file.size);
    throw new AppError(
      400,
      'UPLOAD_MISMATCH',
      actualSize === null
        ? 'The upload did not arrive. Please try again.'
        : 'The uploaded file does not match what was announced. Please try again.',
    );
  }

  const result = await Stash.updateOne(
    { _id: stash._id, files: { $elemMatch: { fileId, status: 'pending' } } },
    { $set: { 'files.$.status': 'ready' } },
  );
  if (result.matchedCount === 0) {
    throw new AppError(409, 'UPLOAD_EXPIRED', 'This upload took too long. Please upload the file again.');
  }
}

/**
 * Returns a short-lived download URL. For a burn-after-read stash, the first download
 * "burns" it: only the person who triggered the burn keeps access, for a few minutes.
 */
export async function getDownloadUrl(stash: StashDoc, tokenId: string, fileId: string) {
  const file = stash.files.find((f) => f.fileId === fileId && f.status === 'ready');
  if (!file) throw fileNotFound();

  if (stash.burnAfterRead && !stash.burnedAt) {
    // Atomic "first one wins": only one request can change burnedAt from null.
    const won = await Stash.findOneAndUpdate(
      { _id: stash._id, burnedAt: null },
      { $set: { burnedAt: new Date(), burnHolder: tokenId } },
      { new: true, projection: { _id: 1 } },
    ).lean();

    if (!won) {
      const fresh = await Stash.findById(stash._id, { burnHolder: 1 }).lean();
      if (!fresh || fresh.burnHolder !== tokenId) throw stashBurned();
    }
  }

  const url = await createDownloadUrl(objectKey(String(stash._id), fileId), file.name);
  return { url };
}

export async function deleteFile(stash: StashDoc, fileId: string): Promise<void> {
  const file = stash.files.find((f) => f.fileId === fileId);
  if (!file) throw fileNotFound();

  const removed = await releaseFile(stash._id, fileId, file.size);
  if (!removed) throw fileNotFound(); // Someone else deleted it a moment ago.

  await deleteObject(objectKey(String(stash._id), fileId)).catch((err) =>
    logger.warn({ err, fileId }, 'could not delete object; the cleanup job will retry'),
  );
}

/**
 * Removes a file entry and gives its space back, in one atomic update.
 * The filter only matches while the file is still there, so space is never released twice.
 */
export async function releaseFile(
  stashId: StashDoc['_id'],
  fileId: string,
  size: number,
): Promise<boolean> {
  const result = await Stash.updateOne(
    { _id: stashId, 'files.fileId': fileId },
    { $pull: { files: { fileId } }, $inc: { totalSize: -size } },
  );
  return result.modifiedCount === 1;
}
