import cron from 'node-cron';
import { CLEANUP_SCHEDULE } from '../config/limits.js';
import { logger } from '../lib/logger.js';
import { runCleanup } from '../services/cleanup.service.js';

let running = false;

async function runOnce() {
  if (running) return; // Never start a new run while the last one is still going.
  running = true;
  try {
    const result = await runCleanup();
    if (result.purgedStashes || result.releasedUploads) logger.info(result, 'cleanup finished');
  } catch (err) {
    logger.error({ err }, 'cleanup failed');
  } finally {
    running = false;
  }
}

/** Starts the cleanup job. Returns a function that stops it. */
export function startCleanupJob(): () => void {
  void runOnce(); // Clean up anything left over from before a restart.
  const task = cron.schedule(CLEANUP_SCHEDULE, () => void runOnce());
  return () => task.stop();
}
