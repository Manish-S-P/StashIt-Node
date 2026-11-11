import { useState, type FormEvent } from 'react';
import type { StashView } from '../lib/api';
import { formatBytes, formatTimeLeft } from '../lib/format';
import { DEFAULT_DURATION, DurationPicker, durationMinutes, type Duration } from './DurationPicker';
import { Button } from './ui';

interface Props {
  stash: StashView;
  now: number;
  onChangeExpiry: (minutes: number) => Promise<void>;
}

/** Time left, space used and file count, in one strip. */
export function StashStats({ stash, now, onChangeExpiry }: Props) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const burnedDeadline = stash.burned && stash.burnDeletesAt ? new Date(stash.burnDeletesAt).getTime() : null;
  const msLeft = (burnedDeadline ?? new Date(stash.expiresAt).getTime()) - now;
  const usedFraction = Math.min(1, stash.usedBytes / stash.maxBytes);
  const nearlyFull = usedFraction > 0.9;

  return (
    <section
      aria-label="Stash details"
      className="grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3"
    >
      <div className="col-span-2 border-b border-line p-5 sm:col-span-1 sm:border-r sm:border-b-0">
        <p className="text-[13px] text-muted">{stash.burned ? 'Burned, deleted in' : 'Deletes in'}</p>
        <p className={`tabular mt-1.5 text-2xl font-medium ${stash.burned ? 'text-amber' : ''}`} aria-live="off">
          {formatTimeLeft(msLeft)}
        </p>
        {!stash.burned && !editing && (
          <div className="mt-2.5 flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
            <span className="text-[13px] text-ok" role="status">
              {saved && 'Updated'}
            </span>
          </div>
        )}
      </div>

      <div className="border-r border-line p-5">
        <p className="text-[13px] text-muted">Storage</p>
        <p className="tabular mt-1.5 text-2xl font-medium whitespace-nowrap">{formatBytes(stash.usedBytes)}</p>
        <p className="tabular text-[13px] text-muted">of {formatBytes(stash.maxBytes)}</p>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-line-strong"
          role="meter"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={stash.maxBytes}
          aria-valuenow={stash.usedBytes}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-500 ${nearlyFull ? 'bg-error' : 'bg-ink'}`}
            style={{ width: `${usedFraction * 100}%` }}
          />
        </div>
      </div>

      <div className="p-5">
        <p className="text-[13px] text-muted">Files</p>
        <p className="tabular mt-1.5">
          <span className="text-2xl font-medium">{stash.files.length}</span>
          <span className="text-muted"> / {stash.maxFiles}</span>
        </p>
      </div>

      {editing && !stash.burned && (
        <ExpiryEditor
          onCancel={() => setEditing(false)}
          onSave={async (minutes) => {
            await onChangeExpiry(minutes);
            setEditing(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        />
      )}
    </section>
  );
}

function ExpiryEditor({ onSave, onCancel }: { onSave: (minutes: number) => Promise<void>; onCancel: () => void }) {
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const [saving, setSaving] = useState(false);
  const minutes = durationMinutes(duration);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (minutes === null) return;
    setSaving(true);
    try {
      await onSave(minutes);
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="col-span-full border-t border-line p-5" noValidate>
      <DurationPicker legend="Delete after, counted from now" value={duration} onChange={setDuration} />
      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="primary" size="md" disabled={saving || minutes === null}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
