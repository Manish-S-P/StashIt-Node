import { useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '../lib/format';
import { UploadIcon } from './icons';

interface Props {
  onFiles: (files: File[]) => void;
  freeBytes: number;
  disabled?: boolean;
}

export function Dropzone({ onFiles, freeBytes, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(files);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center rounded-2xl border border-dashed px-5 py-10 text-center transition-colors ${
        dragging ? 'border-ink/60 bg-field' : 'border-line-strong'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-full border border-line bg-field text-xl text-ink-2">
        <UploadIcon />
      </span>
      <p className="mt-4 text-[15px] text-ink">
        {disabled ? (
          'This stash is full'
        ) : dragging ? (
          'Drop to upload'
        ) : (
          <>
            Drag files here, or{' '}
            <button
              type="button"
              className="rounded text-ink underline decoration-muted underline-offset-4 hover:decoration-ink"
              onClick={() => inputRef.current?.click()}
            >
              choose files
            </button>
          </>
        )}
      </p>
      <p className="tabular mt-1 text-[13px] text-muted">{formatBytes(Math.max(0, freeBytes))} left in this stash</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose files to add"
        data-testid="file-input"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ''; // allow choosing the same file again
          if (files.length) onFiles(files);
        }}
      />
    </div>
  );
}
