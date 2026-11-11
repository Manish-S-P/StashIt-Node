/**
 * An error we expect and want to show to the user.
 * The error handler turns it into: { "error": { "code": "...", "message": "..." } }
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Same message for "no such title" and "wrong password", so attackers can't tell which. */
export const wrongCredentials = () =>
  new AppError(401, 'WRONG_CREDENTIALS', 'Wrong title or password');

export const stashGone = () =>
  new AppError(404, 'STASH_NOT_FOUND', 'This stash has expired or no longer exists');

export const stashBurned = () =>
  new AppError(410, 'STASH_BURNED', 'This stash was burned after its first download');

export const fileNotFound = () =>
  new AppError(404, 'FILE_NOT_FOUND', 'That file is not in this stash');

/** MongoDB error code 11000 = a unique index rejected the write. */
export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 11000;
}
