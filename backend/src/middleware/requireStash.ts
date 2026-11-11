import type { NextFunction, Request, Response } from 'express';
import { AppError, stashBurned, stashGone } from '../lib/errors.js';
import { verifyStashToken } from '../lib/security.js';
import { findActiveStash } from '../services/stash.service.js';

/**
 * Protects routes that act on a stash. Expects "Authorization: Bearer <token>",
 * where the token came from creating or unlocking the stash.
 */
export async function requireStash(req: Request, _res: Response, next: NextFunction) {
  const [scheme, token] = (req.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AppError(401, 'UNAUTHORIZED', 'Open the stash with its title and password first');
  }

  const claims = verifyStashToken(token);
  if (!claims) {
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired. Open the stash again');
  }

  const stash = await findActiveStash(claims.stashId);
  if (!stash) throw stashGone();

  // After a burn, only the visitor who triggered it keeps access.
  if (stash.burnedAt && stash.burnHolder !== claims.tokenId) throw stashBurned();

  req.auth = { stash, tokenId: claims.tokenId };
  next();
}

/** Typed access to what requireStash attached to the request. */
export function getAuth(req: Request) {
  if (!req.auth) throw new AppError(401, 'UNAUTHORIZED', 'Open the stash first');
  return req.auth;
}
