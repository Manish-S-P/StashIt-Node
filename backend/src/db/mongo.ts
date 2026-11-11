import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { Stash } from '../models/stash.model.js';

export async function connectDb(): Promise<void> {
  await mongoose.connect(config.MONGO_URL, { serverSelectionTimeoutMS: 10_000 });
  // Make sure indexes (unique title, TTL) exist before we accept any requests.
  await Stash.init();
  logger.info('Connected to MongoDB');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
