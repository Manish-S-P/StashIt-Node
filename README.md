# StashIt

Password-protected, self-destructing file sharing. Create a stash with a **title** and a **password**, drop in files, and open it from any device with those two things. No accounts. Stashes delete themselves after any time you pick from 1 minute to 7 days, or right after the first download if you turn on burn after read.

Inspired by [dontpad](https://dontpad.com/), but for files.

## Features

- **No accounts**: a stash is opened with its title and password only.
- **Unique titles**: a title can belong to one active stash; it is freed when the stash expires.
- **Multi-file upload** with per-file progress, straight from the browser to storage.
- **100 MB per stash**, up to 20 files, enforced by the server.
- **Shared editing**: anyone with the credentials can download, upload, delete and change the expiry.
- **Expiry**: any time from 1 minute to 7 days (`expiresInMinutes`, 1–10080); files and records are deleted automatically.
- **Burn after read**: the first download locks everyone else out; the stash is deleted 10 minutes later.
- **Security**: Argon2id password hashing, per-stash lockout after 5 wrong passwords, per-IP rate limits, signed short-lived tokens, files always served as downloads.

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, React Router |
| Backend | Node.js 22, Express 5, TypeScript, Zod |
| Database | MongoDB with Mongoose (MongoDB Atlas in production) |
| File storage | Cloudflare R2 through the S3 API (RustFS locally) |
| Security | Argon2id, JWT stash tokens, express-rate-limit, Helmet, CORS |
| Background jobs | node-cron |
| Testing | Vitest + Supertest (API), Playwright (browser), GitHub Actions |
| Hosting | Cloudflare Pages (frontend), Render (API), MongoDB Atlas, Cloudflare R2 |

## How it works

```
Browser (React) ──JSON──▶ Express API ──▶ MongoDB (stash + file records)
      │                        │
      │   presigned URLs ◀─────┘
      └──── file bytes ────────────────▶ Cloudflare R2 (the actual files)
```

The API never touches file bytes. To upload, the browser asks the API for a **presigned URL**, uploads directly to R2, then asks the API to **confirm**. The API checks the real size in storage before the file appears. A cleanup job deletes expired stashes and abandoned uploads every minute.

## Run it locally

You need Node.js 22+, Docker, and Git.

```bash
# 1. Start MongoDB and local S3 storage (RustFS)
docker compose up -d

# 2. Backend
cd backend
cp .env.example .env
npm install
npm run setup:storage     # creates the bucket
npm run dev               # http://localhost:4000

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev               # http://localhost:5173
```

The storage console is at http://localhost:9001 (user `stashit-dev`, password `stashit-dev-secret`).

### Tests

```bash
cd backend && npm test                  # API tests (needs docker compose running)
cd e2e && npm install && npx playwright install chromium && npx playwright test
                                        # browser tests (needs backend and frontend running)
```

GitHub Actions runs all of them on every push.

## Deploy

1. **Cloudflare R2**: create a bucket (e.g. `stashit`). Under *Settings > CORS policy*, allow your frontend origin with methods `PUT`, `GET`, `HEAD` and header `content-type`. Add a lifecycle rule that deletes objects after 8 days as a safety net. Create an R2 API token with *Object Read & Write* for that bucket and note the access key, secret and account ID.
2. **MongoDB Atlas**: create a free cluster, a database user, and allow network access from anywhere (`0.0.0.0/0`, since Render's IPs change). Copy the connection string.
3. **Render**: *New > Blueprint*, pick this repo (it reads `render.yaml`), and fill in `MONGO_URL`, `CORS_ORIGINS`, `S3_ENDPOINT` (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_BUCKET`.
4. **Cloudflare Pages**: connect the repo, root directory `frontend`, build command `npm run build`, output directory `dist`, and environment variable `VITE_API_URL` set to your Render URL.
5. Put the Pages URL into `CORS_ORIGINS` on Render and into the R2 CORS policy.

## API

All responses are JSON. Errors look like `{ "error": { "code": "TITLE_TAKEN", "message": "..." } }`. Routes marked 🔒 need `Authorization: Bearer <token>`.

| Method | Path | Does |
| --- | --- | --- |
| GET | `/api/health` | Server and database status |
| POST | `/api/stashes` | Create a stash; `409` if the title is taken |
| POST | `/api/stashes/unlock` | Open a stash with title + password; returns a token |
| GET 🔒 | `/api/stash` | The stash: files, space used, expiry |
| PATCH 🔒 | `/api/stash` | Change the expiry |
| POST 🔒 | `/api/stash/files/upload-url` | Reserve space, get a presigned upload URL |
| POST 🔒 | `/api/stash/files/:fileId/confirm` | Verify the upload and list the file |
| GET 🔒 | `/api/stash/files/:fileId/download-url` | Presigned download URL (may burn the stash) |
| DELETE 🔒 | `/api/stash/files/:fileId` | Delete a file |

## Project structure

```
backend/src
├── server.ts            starts the app, DB connection, cleanup job, graceful shutdown
├── app.ts               Express app: middleware and routes
├── config/              environment variables (validated) and product limits
├── routes/              HTTP layer: parse request, call service, send response
├── services/            business rules: stashes, files, cleanup
├── models/              Mongoose schema for a stash (files embedded)
├── middleware/          auth (requireStash), rate limits, error handler
├── lib/                 storage (S3/R2), security (Argon2, JWT), errors, logger
└── jobs/                scheduled cleanup
frontend/src
├── pages/               HomePage (open/create), StashPage
├── components/          ticket header, drop zone, upload list, file list
└── lib/                 API client, session storage, upload with progress
e2e/                     Playwright browser tests
```
