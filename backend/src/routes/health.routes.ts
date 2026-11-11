import { Router } from 'express';
import { isDbReady } from '../db/mongo.js';

export const healthRouter = Router();

// Used by the hosting platform to check the server is alive.
healthRouter.get('/health', (_req, res) => {
  const dbUp = isDbReady();
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', database: dbUp ? 'up' : 'down' });
});
