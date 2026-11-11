import { useState } from 'react';
import type { StashFile } from '../lib/api';
import { formatAgo, formatBytes } from '../lib/format';
import { DownloadIcon, FileIcon, TrashIcon } from './icons';
import { Button } from './ui';

interface Props {
  files: StashFile[];
  now: number;
  /** True when the next download will burn the stash. */
  downloadBurns: boolean;
  onDownload: (fileId: string) => Promise<void>;
  onDelete: (fileId: string) => Promise<void>;
}

export function FileList({ files, now, downloadBurns, onDownload, onDelete }: Props) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center">
        <p className="text-ink">No files yet</p>
        <p className="mt-1 text-[13px] text-muted">Files you upload will show up here for everyone with the password.</p>
      </div>
    );
  }

  return (
    <ul
      className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface"
      aria-label="Files in this stash"
    >
      {files.map((file) => (
        <FileRow
          key={file.id}
          file={file}
          now={now}
          downloadBurns={downloadBurns}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}

function FileRow({
  file,
  now,
  downloadBurns,
  onDownload,
  onDelete,
}: Omit<Props, 'files'> & { file: StashFile }) {
  const [confirm, setConfirm] = useState<'none' | 'burn' | 'delete'>('none');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
      setConfirm('none');
    }
  }

  return (
    <li className="px-4 py-3.5 transition-colors hover:bg-field/60 sm:px-5">
      <div className="flex items-center gap-3 sm:gap-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-field text-lg text-muted">
          <FileIcon />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-ink" title={file.name}>
            {file.name}
          </p>
          <p className="tabular truncate text-[13px] text-muted">
            {formatBytes(file.size)}, added {formatAgo(file.uploadedAt, now)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant={downloadBurns ? 'secondary' : 'tinted'}
            size="sm"
            disabled={busy || confirm !== 'none'}
            onClick={() => (downloadBurns ? setConfirm('burn') : run(() => onDownload(file.id)))}
          >
            <DownloadIcon className="text-base" />
            <span className="sr-only sm:not-sr-only">Download</span>
          </Button>
          <Button
            variant="dangerQuiet"
            size="sm"
            aria-label="Delete"
            className="w-8 px-0"
            disabled={busy || confirm !== 'none'}
            onClick={() => setConfirm('delete')}
          >
            <TrashIcon className="text-base" />
          </Button>
        </div>
      </div>

      {confirm === 'burn' && (
        <div
          className="mt-3 rounded-xl border border-amber/25 bg-amber-soft p-3.5"
          role="alertdialog"
          aria-label="Confirm burn"
        >
          <p className="text-sm text-ink-2">
            Downloading burns this stash. Everyone else loses access, and it is deleted 10 minutes from now.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="burn" size="sm" disabled={busy} onClick={() => run(() => onDownload(file.id))}>
              Download and burn
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {confirm === 'delete' && (
        <div
          className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-error/25 bg-error-soft p-3.5"
          role="alertdialog"
          aria-label="Confirm delete"
        >
          <p className="mr-auto text-sm text-ink-2">Delete this file for everyone?</p>
          <Button variant="danger" size="sm" disabled={busy} onClick={() => run(() => onDelete(file.id))}>
            Delete file
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirm('none')}>
            Keep it
          </Button>
        </div>
      )}
    </li>
  );
}
