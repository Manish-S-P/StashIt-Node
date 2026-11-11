import { formatBytes } from '../lib/format';

export interface UploadItem {
  key: string;
  name: string;
  size: number;
  progress: number;
  status: 'waiting' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadList({ items, onDismiss }: { items: UploadItem[]; onDismiss: (key: string) => void }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2" aria-label="Uploads in progress">
      {items.map((item) => (
        <li key={item.key} className="rounded-xl border border-line bg-surface px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium" title={item.name}>
              {item.name}
            </span>
            <span
              className={`tabular shrink-0 ${
                item.status === 'error' ? 'text-error' : item.status === 'done' ? 'text-ok' : 'text-muted'
              }`}
            >
              {item.status === 'error'
                ? 'Failed'
                : item.status === 'done'
                  ? 'Uploaded'
                  : item.status === 'waiting'
                    ? 'Waiting…'
                    : `${Math.round(item.progress * 100)}% of ${formatBytes(item.size)}`}
            </span>
          </div>

          {item.status === 'error' ? (
            <div className="mt-1.5 flex items-start justify-between gap-3 text-sm text-error" role="alert">
              <span>{item.error}</span>
              <button
                type="button"
                className="shrink-0 rounded font-medium text-ink-2 underline underline-offset-4 hover:text-ink"
                onClick={() => onDismiss(item.key)}
              >
                Dismiss
              </button>
            </div>
          ) : (
            <div
              className="mt-2 h-1 overflow-hidden rounded-full bg-line-strong"
              role="progressbar"
              aria-label={`Uploading ${item.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(item.progress * 100)}
            >
              <div
                className={`h-full rounded-full transition-[width] ${item.status === 'done' ? 'bg-ok' : 'bg-ink'}`}
                style={{ width: `${item.progress * 100}%` }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
