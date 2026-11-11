// Every call to the backend goes through this file.

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

/** Shortest and longest time a stash can live, in minutes (the backend enforces the same range). */
export const MIN_EXPIRY_MINUTES = 1;
export const MAX_EXPIRY_MINUTES = 7 * 24 * 60;

export interface StashFile {
  id: string;
  name: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

export interface StashView {
  title: string;
  files: StashFile[];
  usedBytes: number;
  maxBytes: number;
  maxFiles: number;
  expiresAt: string;
  burnAfterRead: boolean;
  burned: boolean;
  burnDeletesAt: string | null;
}

export interface UploadTicket {
  fileId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

/** An error the backend described, e.g. { status: 409, code: "TITLE_TAKEN" }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string;
}

async function request<T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach StashIt. Check your connection and try again.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? 'UNKNOWN_ERROR',
      data?.error?.message ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

export const api = {
  createStash: (input: { title: string; password: string; expiresInMinutes: number; burnAfterRead: boolean }) =>
    request<{ token: string; stash: StashView }>('/api/stashes', { method: 'POST', body: input }),

  unlockStash: (input: { title: string; password: string }) =>
    request<{ token: string; stash: StashView }>('/api/stashes/unlock', { method: 'POST', body: input }),

  getStash: (token: string) => request<{ stash: StashView }>('/api/stash', { token }),

  updateExpiry: (token: string, expiresInMinutes: number) =>
    request<{ stash: StashView }>('/api/stash', { method: 'PATCH', token, body: { expiresInMinutes } }),

  requestUpload: (token: string, file: { name: string; size: number; contentType: string }) =>
    request<UploadTicket>('/api/stash/files/upload-url', { method: 'POST', token, body: file }),

  confirmUpload: (token: string, fileId: string) =>
    request<{ stash: StashView }>(`/api/stash/files/${encodeURIComponent(fileId)}/confirm`, {
      method: 'POST',
      token,
    }),

  getDownloadUrl: (token: string, fileId: string) =>
    request<{ url: string }>(`/api/stash/files/${encodeURIComponent(fileId)}/download-url`, { token }),

  deleteFile: (token: string, fileId: string) =>
    request<void>(`/api/stash/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', token }),
};
