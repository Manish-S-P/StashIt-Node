import { z } from 'zod';
import { DEFAULT_EXPIRY_MINUTES, MAX_EXPIRY_MINUTES, MIN_EXPIRY_MINUTES } from '../config/limits.js';

// Zod schemas describe what a valid request body looks like.
// Anything that doesn't match is rejected with a 422 before our logic runs.

const EXPIRY_MESSAGE = 'Expiry must be a whole number of minutes, from 1 minute to 7 days';
const expiresInMinutes = z
  .number({ message: EXPIRY_MESSAGE })
  .int(EXPIRY_MESSAGE)
  .min(MIN_EXPIRY_MINUTES, EXPIRY_MESSAGE)
  .max(MAX_EXPIRY_MINUTES, EXPIRY_MESSAGE);

const title = z
  .string({ message: 'Title is required' })
  .trim()
  .min(3, 'Title must be at least 3 characters')
  .max(64, 'Title can be at most 64 characters')
  .regex(/^[^\p{C}]+$/u, 'Title contains invalid characters');

const password = z
  .string({ message: 'Password is required' })
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password can be at most 128 characters');

export const createStashBody = z.object({
  title,
  password,
  expiresInMinutes: expiresInMinutes.default(DEFAULT_EXPIRY_MINUTES),
  burnAfterRead: z.boolean().default(false),
});

export const unlockStashBody = z.object({
  title: z.string({ message: 'Title is required' }).trim().min(1, 'Title is required').max(64),
  password: z.string({ message: 'Password is required' }).min(1, 'Password is required').max(128),
});

export const updateStashBody = z.object({
  expiresInMinutes,
});

export const uploadUrlBody = z.object({
  name: z
    .string({ message: 'File name is required' })
    .trim()
    .min(1, 'File name is required')
    .max(255, 'File name can be at most 255 characters'),
  size: z
    .number({ message: 'File size is required' })
    .int('File size must be a whole number of bytes')
    .positive('Empty files cannot be uploaded'),
  contentType: z.string().max(255).optional(),
});

export type CreateStashInput = z.infer<typeof createStashBody>;
export type UnlockStashInput = z.infer<typeof unlockStashBody>;
export type UploadUrlInput = z.infer<typeof uploadUrlBody>;
