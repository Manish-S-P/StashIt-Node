/**
 * One-time storage setup: creates the bucket (if missing) and allows the frontend
 * to upload to it from the browser (CORS).
 *
 * Run with: npm run setup:storage
 *
 * For Cloudflare R2 you may prefer the dashboard (see README); R2 API tokens
 * scoped to one bucket are not allowed to create buckets or change CORS.
 */
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env.js';
import { s3 } from '../lib/storage.js';

const Bucket = config.S3_BUCKET;

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
    console.log(`Bucket "${Bucket}" already exists`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }));
    console.log(`Created bucket "${Bucket}"`);
  }
}

async function configureCors() {
  try {
    await s3.send(
      new PutBucketCorsCommand({
        Bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: config.corsOrigins,
              AllowedMethods: ['PUT', 'GET', 'HEAD'],
              AllowedHeaders: ['content-type'],
              ExposeHeaders: ['ETag'],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      }),
    );
    console.log(`CORS allows uploads from: ${config.corsOrigins.join(', ')}`);
  } catch (err) {
    console.warn(
      'Could not set bucket CORS through the API. Configure it in your storage dashboard instead.\n' +
        `  Reason: ${(err as Error).message}`,
    );
  }
}

await ensureBucket();
await configureCors();
console.log('Storage is ready.');
