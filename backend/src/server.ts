import { createApp } from './app.js';
import { config } from './config/env.js';
import { connectDb, disconnectDb } from './db/mongo.js';
import { startCleanupJob } from './jobs/cleanup.job.js';
import { logger } from './lib/logger.js';

async function main() {
  await connectDb();
  const stopCleanup = startCleanupJob();

  const server = createApp().listen(config.PORT, () => {
    logger.info(`StashIt API listening on http://localhost:${config.PORT}`);
  });

  // On deploys the platform sends SIGTERM: finish open requests, then exit cleanly.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    stopCleanup();
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'failed to start');
  process.exit(1);
});
