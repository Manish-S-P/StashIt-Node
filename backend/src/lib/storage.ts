import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { DOWNLOAD_URL_TTL_SECONDS, UPLOAD_URL_TTL_SECONDS } from '../config/limits.js';

/**
 * One S3 client for the whole app. Cloudflare R2 (production) and RustFS (local)
 * both speak the S3 API, so only the endpoint and keys differ between them.
 */
export const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
  // URLs look like https://host/bucket/key, which works on every S3-compatible service.
  forcePathStyle: true,
  // Newer AWS SDKs add checksum headers by default; some non-AWS services reject them.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const Bucket = config.S3_BUCKET;

/** Files are stored under stashes/<stashId>/<fileId>, never under the user's filename. */
export const objectKey = (stashId: string, fileId: string) => `stashes/${stashId}/${fileId}`;
export const stashPrefix = (stashId: string) => `stashes/${stashId}/`;

/**
 * A URL the browser can PUT one file to, directly, without going through our server.
 * Content-Type is part of the signature, so the browser must send exactly this type.
 * Note: storage does not enforce the size here. We check the real size after upload.
 */
export function createUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(['content-type']),
  });
}

/** A short-lived URL that downloads the file (never displays it in the browser). */
export function createDownloadUrl(key: string, fileName: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: attachmentHeader(fileName),
      ResponseContentType: 'application/octet-stream',
    }),
    { expiresIn: DOWNLOAD_URL_TTL_SECONDS },
  );
}

/** The real size of an uploaded object in bytes, or null if it doesn't exist. */
export async function objectSize(key: string): Promise<number | null> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
}

/** Deletes every object whose key starts with the prefix. Returns how many were deleted. */
export async function deletePrefix(prefix: string): Promise<number> {
  let deleted = 0;
  let continuationToken: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken: continuationToken }),
    );
    const keys = (page.Contents ?? []).flatMap((object) => (object.Key ? [object.Key] : []));
    await Promise.all(keys.map((key) => deleteObject(key)));
    deleted += keys.length;
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return deleted;
}

function isNotFound(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}

/** Content-Disposition that forces a download and keeps non-English filenames intact. */
function attachmentHeader(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
