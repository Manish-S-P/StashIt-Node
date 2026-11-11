import pino from 'pino';
import { config } from '../config/env.js';

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  // Never write secrets to logs.
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  // Human-friendly colored logs while developing; plain JSON in production.
  ...(config.NODE_ENV === 'development' && {
    transport: { target: 'pino-pretty', options: { colorize: true } },
  }),
});
