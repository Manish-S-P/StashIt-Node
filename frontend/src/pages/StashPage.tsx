import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Dropzone } from '../components/Dropzone';
import { FileList } from '../components/FileList';
import { GoneState, type GoneReason } from '../components/GoneState';
import { FlameIcon } from '../components/icons';
import { StashStats } from '../components/StashStats';
import { Alert, Button } from '../components/ui';
import { UploadList, type UploadItem } from '../components/UploadList';
import { TopBar, Wordmark } from '../components/Wordmark';
import { useNow } from '../hooks/useNow';
import { ApiError, api, type StashView } from '../lib/api';
import { clearSession, loadSession } from '../lib/session';
import { contentTypeOf, putFile } from '../lib/upload';

const REFRESH_MS = 15_000; // pick up changes made by other visitors
const PARALLEL_UPLOADS = 3;
let uploadCounter = 0;

/** Errors that mean the stash itself is no longer reachable. */
function goneReason(err: unknown): GoneReason | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === 'STASH_NOT_FOUND') return 'expired';
  if (err.status === 410) return 'burned';
  if (err.status === 401) return 'session';
  return null;
}

/** Runs `worker` over `items`, at most `limit` at a time. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) await worker(next);
  });
  await Promise.all(runners);
}

function triggerDownload(url: string) {
  // The URL answers with "Content-Disposition: attachment", so the browser saves the file
  // and stays on this page.
  const link = document.createElement('a');
  link.href = url;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function StashPage() {
  const navigate = useNavigate();
  const [session] = useState(loadSession);
  const [stash, setStash] = useState<StashView | null>(null);
  const [gone, setGone] = useState<GoneReason | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const now = useNow();
  const token = session?.token ?? '';

  useEffect(() => {
    if (!session) navigate('/', { replace: true });
  }, [session, navigate]);

  const handleError = useCallback((err: unknown) => {
    const reason = goneReason(err);
    if (reason) {
      clearSession();
      setGone(reason);
    } else {
      setNotice(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const result = await api.getStash(token);
      setStash(result.stash);
    } catch (err) {
      handleError(err);
    }
  }, [token, handleError]);

  // Load now, then keep in sync with other visitors.
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (!document.hidden) void refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // When the countdown reaches zero, the stash is gone.
  useEffect(() => {
    if (!stash || gone) return;
    const deadline = stash.burned && stash.burnDeletesAt ? stash.burnDeletesAt : stash.expiresAt;
    if (now >= new Date(deadline).getTime()) {
      clearSession();
      setGone(stash.burned ? 'burned' : 'expired');
    }
  }, [now, stash, gone]);

  const updateUpload = (key: string, patch: Partial<UploadItem>) =>
    setUploads((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function uploadOne(item: UploadItem, file: File) {
    updateUpload(item.key, { status: 'uploading' });
    try {
      // 1. Reserve space and get a presigned URL from our API.
      const ticket = await api.requestUpload(token, {
        name: file.name,
        size: file.size,
        contentType: contentTypeOf(file),
      });
      // 2. Send the bytes straight to storage.
      await putFile(ticket.uploadUrl, file, ticket.headers, (progress) => updateUpload(item.key, { progress }));
      // 3. Tell the API it arrived, so it checks the size and lists the file.
      const result = await api.confirmUpload(token, ticket.fileId);
      setStash(result.stash);
      updateUpload(item.key, { status: 'done', progress: 1 });
      setTimeout(() => setUploads((list) => list.filter((u) => u.key !== item.key)), 1500);
    } catch (err) {
      if (goneReason(err)) return handleError(err);
      updateUpload(item.key, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed. Please try again.',
      });
    }
  }

  function addFiles(files: File[]) {
    const jobs = files.map((file) => {
      const item: UploadItem = {
        key: `upload-${++uploadCounter}`,
        name: file.name,
        size: file.size,
        progress: 0,
        status: file.size === 0 ? 'error' : 'waiting',
        error: file.size === 0 ? 'Empty files cannot be added.' : undefined,
      };
      return { item, file };
    });
    setUploads((list) => [...list, ...jobs.map((job) => job.item)]);
    void runPool(
      jobs.filter((job) => job.item.status === 'waiting'),
      PARALLEL_UPLOADS,
      (job) => uploadOne(job.item, job.file),
    );
  }

  async function download(fileId: string) {
    try {
      const { url } = await api.getDownloadUrl(token, fileId);
      triggerDownload(url);
      if (stash?.burnAfterRead) await refresh(); // show the burn countdown
    } catch (err) {
      handleError(err);
    }
  }

  async function removeFile(fileId: string) {
    try {
      await api.deleteFile(token, fileId);
      await refresh();
    } catch (err) {
      handleError(err);
    }
  }

  async function changeExpiry(minutes: number) {
    try {
      const result = await api.updateExpiry(token, minutes);
      setStash(result.stash);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  function closeStash() {
    clearSession();
    navigate('/');
  }

  const inFlightBytes = uploads
    .filter((u) => u.status === 'waiting' || u.status === 'uploading')
    .reduce((sum, u) => sum + u.size, 0);

  return (
    <div className="min-h-dvh">
      <TopBar>
        <div className="flex min-w-0 items-center gap-3">
          <Wordmark />
          {session && !gone && (
            <>
              <span className="text-line-strong" aria-hidden="true">
                /
              </span>
              <span className="truncate text-[13px] text-muted">{stash?.title ?? session.title}</span>
            </>
          )}
        </div>
        {!gone && session && (
          <Button variant="secondary" size="sm" onClick={closeStash}>
            Close stash
          </Button>
        )}
      </TopBar>

      <main className="mx-auto w-full max-w-3xl px-5 pt-12 pb-20 sm:px-8">
        {gone ? (
          <GoneState reason={gone} />
        ) : !stash ? (
          <p className="text-muted" role="status">
            Opening {session?.title ?? 'stash'}…
          </p>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="font-serif text-[34px] leading-[1.15] tracking-tight break-words sm:text-[40px]">{stash.title}</h1>
              <p className="mt-2 text-[15px] text-muted">Anyone with the title and password can see, add and delete these files.</p>
            </div>

            <StashStats stash={stash} now={now} onChangeExpiry={changeExpiry} />

            {stash.burnAfterRead && <BurnNotice burned={stash.burned} />}

            {notice && (
              <Alert>
                <div className="flex items-start justify-between gap-3">
                  <span>{notice}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded font-medium underline underline-offset-2"
                    onClick={() => setNotice(null)}
                  >
                    Dismiss
                  </button>
                </div>
              </Alert>
            )}

            {!stash.burned && (
              <section aria-label="Add files">
                <Dropzone
                  onFiles={addFiles}
                  freeBytes={stash.maxBytes - stash.usedBytes - inFlightBytes}
                  disabled={stash.files.length >= stash.maxFiles}
                />
                <UploadList
                  items={uploads}
                  onDismiss={(key) => setUploads((list) => list.filter((u) => u.key !== key))}
                />
              </section>
            )}

            <section aria-labelledby="files-heading" className="pt-2">
              <h2 id="files-heading" className="mb-3 font-serif text-2xl tracking-tight">
                Files
              </h2>
              <FileList
                files={stash.files}
                now={now}
                downloadBurns={stash.burnAfterRead && !stash.burned}
                onDownload={download}
                onDelete={removeFile}
              />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function BurnNotice({ burned }: { burned: boolean }) {
  return (
    <div
      className="flex gap-3 rounded-2xl border border-amber/25 bg-amber-soft px-4 py-3.5 text-sm text-ink-2"
      role="status"
    >
      <FlameIcon className="mt-0.5 shrink-0 text-base text-amber" />
      {burned ? (
        <p>
          <strong className="font-medium text-ink">You downloaded first, so this stash is yours alone now.</strong>{' '}
          Everyone else is locked out. Download everything you need before the countdown ends.
        </p>
      ) : (
        <p>
          <strong className="font-medium text-ink">Burn after read is on.</strong> The first download locks this
          stash for everyone else and deletes it 10 minutes later.
        </p>
      )}
    </div>
  );
}
