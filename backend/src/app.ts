import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { fileRouter } from './routes/file.routes.js';
import { healthRouter } from './routes/health.routes.js';
import { stashRouter } from './routes/stash.routes.js';

/**
 * Builds the Express app without starting it, so tests can use it directly.
 * Middleware runs top to bottom for every request.
 */
export function createApp() {
  const app = express();

  // Behind Render's proxy, read the real client IP from X-Forwarded-For.
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(helmet()); // Security headers.
  app.use(
    cors({
      origin: config.corsOrigins, // Only our frontend may call the API from a browser.
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '10kb' })); // Bodies are small JSON; files never pass through here.
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
    }),
  );
  app.use('/api', apiLimiter);

  app.use('/api', healthRouter);
  app.use('/api', stashRouter);
  app.use('/api/stash/files', fileRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
