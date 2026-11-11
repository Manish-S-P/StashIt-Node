import type { z } from 'zod';
import { AppError } from './errors.js';

/**
 * Checks untrusted input (a request body) against a Zod schema.
 * Returns typed, cleaned data, or throws a 422 error listing what's wrong.
 */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new AppError(422, 'VALIDATION_ERROR', details[0]?.message ?? 'Invalid input', details);
  }
  return result.data;
}
