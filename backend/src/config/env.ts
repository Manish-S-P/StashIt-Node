import { z } from 'zod';

// Load variables from backend/.env when it exists (local development).
// In production the hosting platform sets real environment variables instead.
// Variables that are already set are never overwritten.
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on the real environment.
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URL: z.string().min(1, 'MONGO_URL is required'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  S3_ENDPOINT: z.url('S3_ENDPOINT must be a URL'),
  S3_REGION: z.string().min(1).default('auto'),
  S3_ACCESS_KEY_ID: z.string().min(1, 'S3_ACCESS_KEY_ID is required'),
  S3_SECRET_ACCESS_KEY: z.string().min(1, 'S3_SECRET_ACCESS_KEY is required'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  MAX_STASH_MB: z.coerce.number().positive().default(100),
  MAX_FILES_PER_STASH: z.coerce.number().int().positive().default(20),
  // Requests allowed per IP address every 15 minutes.
  RATE_LIMIT_API: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a server with missing secrets should never start.
  console.error('Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

export const config = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxStashBytes: Math.floor(env.MAX_STASH_MB * 1024 * 1024),
};
