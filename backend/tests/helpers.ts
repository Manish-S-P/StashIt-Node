import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/db/mongo.js';
import { Stash } from '../src/models/stash.model.js';

export const app = createApp();
export const api = () => request(app);

/** Connects to the test database before a test file and cleans up after it. */
export function useTestDb() {
  beforeAll(async () => {
    await connectDb();
  });
  afterAll(async () => {
    await Stash.deleteMany({});
    await disconnectDb();
  });
}

/** A unique title, so tests never collide with each other. */
export const uniqueTitle = (label = 'stash') => `${label}-${randomUUID().slice(0, 8)}`;

export const PASSWORD = 'correct-horse';

export async function createStash(overrides: Record<string, unknown> = {}) {
  const title = uniqueTitle();
  const res = await api()
    .post('/api/stashes')
    .send({ title, password: PASSWORD, expiresInMinutes: 1440, ...overrides });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { title: (overrides.title as string) ?? title, token: res.body.token as string, body: res.body };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

/** The full browser upload flow: ask for a URL, PUT the bytes to storage, confirm. */
export async function uploadFile(token: string, name: string, content: Buffer, contentType = 'text/plain') {
  const ticket = await api()
    .post('/api/stash/files/upload-url')
    .set(auth(token))
    .send({ name, size: content.length, contentType });
  if (ticket.status !== 201) throw new Error(`upload-url failed: ${ticket.status} ${JSON.stringify(ticket.body)}`);

  const put = await fetch(ticket.body.uploadUrl, {
    method: 'PUT',
    headers: ticket.body.headers,
    body: content,
  });
  if (!put.ok) throw new Error(`PUT to storage failed: ${put.status} ${await put.text()}`);

  const confirm = await api().post(`/api/stash/files/${ticket.body.fileId}/confirm`).set(auth(token));
  if (confirm.status !== 200) throw new Error(`confirm failed: ${confirm.status} ${JSON.stringify(confirm.body)}`);

  return { fileId: ticket.body.fileId as string, stash: confirm.body.stash };
}
