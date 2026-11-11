import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { TOKEN_TTL_SECONDS } from '../config/limits.js';

// ---------- Passwords ----------

/** Argon2id: slow on purpose, so a leaked database is very expensive to brute-force. */
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * When a title doesn't exist we still run one Argon2 verify.
 * Otherwise "unknown title" would answer much faster than "wrong password",
 * and an attacker could use the response time to discover which titles exist.
 */
export async function spendVerifyTime(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomUUID());
  await verifyPassword(await dummyHash, password);
}

// ---------- Stash tokens ----------

export interface StashClaims {
  stashId: string;
  /** Unique id of this token. Used to know who "won" a burn-after-read stash. */
  tokenId: string;
}

/** A signed, short-lived token that proves "this browser unlocked this stash". */
export function signStashToken(stashId: string): string {
  return jwt.sign({ tid: randomUUID() }, config.JWT_SECRET, {
    subject: stashId,
    expiresIn: TOKEN_TTL_SECONDS,
    algorithm: 'HS256',
  });
}

/** Returns the claims, or null if the token is missing, tampered with or expired. */
export function verifyStashToken(token: string): StashClaims | null {
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub || typeof payload.tid !== 'string') {
      return null;
    }
    return { stashId: payload.sub, tokenId: payload.tid };
  } catch {
    return null;
  }
}
