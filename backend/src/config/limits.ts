// Product rules in one place, so they are easy to find and explain.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long a stash can live, in minutes: anything from 1 minute to 7 days. */
export const MIN_EXPIRY_MINUTES = 1;
export const MAX_EXPIRY_MINUTES = (7 * DAY) / MINUTE;
export const DEFAULT_EXPIRY_MINUTES = DAY / MINUTE;

/** Turns an expiry in minutes into the moment the stash expires. */
export const expiryDate = (minutes: number) => new Date(Date.now() + minutes * MINUTE);

/** After the first download of a burn-after-read stash, the downloader gets this long to grab the rest. */
export const BURN_WINDOW_MS = 10 * MINUTE;

/** An upload that is requested but never confirmed is released after this long. */
export const PENDING_UPLOAD_TTL_MS = 15 * MINUTE;

/** Wrong passwords allowed before a stash locks, and how long it stays locked. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_DURATION_MS = 15 * MINUTE;

/** How long a stash token (the "session" after unlocking) stays valid. */
export const TOKEN_TTL_SECONDS = 2 * 60 * 60;

/** How long presigned storage URLs stay valid. */
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** How often the cleanup job runs (cron syntax: every minute, since a stash can live for just 1 minute). */
export const CLEANUP_SCHEDULE = '* * * * *';
