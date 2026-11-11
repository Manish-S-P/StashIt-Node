import { rateLimit } from 'express-rate-limit';
import { config } from '../config/env.js';
import { AppError } from '../lib/errors.js';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function limiter(limit: number) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Automated tests send many requests from one machine.
    skip: () => config.NODE_ENV === 'test',
    handler: (_req, _res, next) => {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please wait a few minutes.'));
    },
  });
}

/** Every API call, per IP address. */
export const apiLimiter = limiter(config.RATE_LIMIT_API);

/** Creating and unlocking stashes, per IP address. Slows down password guessing. */
export const authLimiter = limiter(config.RATE_LIMIT_AUTH);
