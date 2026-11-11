import { isValidObjectId } from 'mongoose';
import { config } from '../config/env.js';
import {
  BURN_WINDOW_MS,
  LOCK_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  expiryDate,
} from '../config/limits.js';
import { AppError, isDuplicateKeyError, stashBurned, stashGone, wrongCredentials } from '../lib/errors.js';
import { hashPassword, spendVerifyTime, verifyPassword } from '../lib/security.js';
import { Stash, type StashDoc } from '../models/stash.model.js';
import type { CreateStashInput, UnlockStashInput } from '../schemas/stash.schemas.js';
import { purgeStash } from './cleanup.service.js';

/** "  My   Notes " and "my notes" are the same stash. */
export function normalizeTitle(title: string): string {
  return title.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function createStash(input: CreateStashInput): Promise<StashDoc> {
  const titleKey = normalizeTitle(input.title);

  // The title might still belong to a stash that expired but hasn't been cleaned up yet.
  const expired = await Stash.findOne({ titleKey, expiresAt: { $lte: new Date() } }, { _id: 1 }).lean();
  if (expired) await purgeStash(expired._id);

  const passwordHash = await hashPassword(input.password);

  try {
    const stash = await Stash.create({
      title: input.title.trim().replace(/\s+/g, ' '),
      titleKey,
      passwordHash,
      expiresAt: expiryDate(input.expiresInMinutes),
      burnAfterRead: input.burnAfterRead,
    });
    return stash.toObject<StashDoc>();
  } catch (err) {
    // The unique index on titleKey decides, even if two people create at the same instant.
    if (isDuplicateKeyError(err)) {
      throw new AppError(
        409,
        'TITLE_TAKEN',
        'A stash with this title already exists. Pick another title, or open it with its password.',
      );
    }
    throw err;
  }
}

export async function unlockStash(input: UnlockStashInput): Promise<StashDoc> {
  const now = new Date();
  const stash = await Stash.findOne({
    titleKey: normalizeTitle(input.title),
    expiresAt: { $gt: now },
    burnedAt: null,
  }).lean<StashDoc>();

  if (!stash) {
    await spendVerifyTime(input.password);
    throw wrongCredentials();
  }

  if (stash.lockedUntil && stash.lockedUntil > now) {
    const minutes = Math.ceil((stash.lockedUntil.getTime() - now.getTime()) / 60_000);
    throw new AppError(
      429,
      'STASH_LOCKED',
      `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }

  const ok = await verifyPassword(stash.passwordHash, input.password);
  if (!ok) {
    await recordFailedAttempt(stash._id);
    throw wrongCredentials();
  }

  if (stash.failedAttempts > 0 || stash.lockedUntil) {
    await Stash.updateOne({ _id: stash._id }, { $set: { failedAttempts: 0, lockedUntil: null } });
  }
  return stash;
}

async function recordFailedAttempt(stashId: StashDoc['_id']): Promise<void> {
  // $inc is atomic, so parallel wrong guesses are all counted.
  const updated = await Stash.findOneAndUpdate(
    { _id: stashId },
    { $inc: { failedAttempts: 1 } },
    { new: true, projection: { failedAttempts: 1 } },
  ).lean();

  if (updated && updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    await Stash.updateOne(
      { _id: stashId, failedAttempts: { $gte: MAX_FAILED_ATTEMPTS } },
      { $set: { failedAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } },
    );
  }
}

/** Loads a stash that is still usable. Returns null if it doesn't exist or has expired. */
export async function findActiveStash(stashId: string): Promise<StashDoc | null> {
  if (!isValidObjectId(stashId)) return null;
  return Stash.findOne({ _id: stashId, expiresAt: { $gt: new Date() } }).lean<StashDoc>();
}

export async function updateExpiry(stash: StashDoc, expiresInMinutes: number): Promise<StashDoc> {
  const updated = await Stash.findOneAndUpdate(
    { _id: stash._id, burnedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { expiresAt: expiryDate(expiresInMinutes) } },
    { new: true },
  ).lean<StashDoc>();

  if (!updated) {
    const fresh = await Stash.findById(stash._id, { burnedAt: 1 }).lean();
    throw fresh?.burnedAt ? stashBurned() : stashGone();
  }
  return updated;
}

/** What the API returns about a stash. Never includes the password hash. */
export function toStashView(stash: StashDoc) {
  const burnDeletesAt = stash.burnedAt
    ? new Date(stash.burnedAt.getTime() + BURN_WINDOW_MS).toISOString()
    : null;

  return {
    title: stash.title,
    files: stash.files
      .filter((file) => file.status === 'ready')
      .map((file) => ({
        id: file.fileId,
        name: file.name,
        size: file.size,
        contentType: file.contentType,
        uploadedAt: file.createdAt.toISOString(),
      })),
    usedBytes: stash.totalSize,
    maxBytes: config.maxStashBytes,
    maxFiles: config.MAX_FILES_PER_STASH,
    expiresAt: stash.expiresAt.toISOString(),
    burnAfterRead: stash.burnAfterRead,
    burned: Boolean(stash.burnedAt),
    burnDeletesAt,
  };
}

export type StashView = ReturnType<typeof toStashView>;
