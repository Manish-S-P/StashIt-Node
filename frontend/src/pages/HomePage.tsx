import { useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  DEFAULT_DURATION,
  DURATION_ERROR,
  DurationPicker,
  durationMinutes,
  type Duration,
} from '../components/DurationPicker';
import { Alert, Button } from '../components/ui';
import { TopBar, Wordmark } from '../components/Wordmark';
import { ApiError, api } from '../lib/api';
import { saveSession } from '../lib/session';

type Mode = 'open' | 'create';

export function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar>
        <Wordmark />
        <span className="text-[13px] text-muted">No sign-up</span>
      </TopBar>

      <main className="mx-auto w-full max-w-[460px] flex-1 animate-rise px-5 pt-14 pb-20 sm:pt-20">
        <h1 className="font-serif text-[34px] leading-[1.15] tracking-tight text-balance sm:text-[40px]">
          Share files with a title and a password.
        </h1>
        <p className="mt-3 text-[15px] text-muted">Anyone who knows both can open the stash from any device.</p>

        <StashForm />

        <p className="mt-6 text-center text-[13px] text-muted">Up to 100 MB. There is no password recovery.</p>
      </main>
    </div>
  );
}

function StashForm() {
  const navigate = useNavigate();
  const ids = useId();
  const [mode, setMode] = useState<Mode>('open');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [duration, setDuration] = useState<Duration>(DEFAULT_DURATION);
  const [burnAfterRead, setBurnAfterRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; titleTaken?: boolean } | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const expiresInMinutes = durationMinutes(duration);
    if (mode === 'create' && expiresInMinutes === null) {
      setError({ message: DURATION_ERROR });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === 'create'
          ? await api.createStash({ title, password, expiresInMinutes: expiresInMinutes!, burnAfterRead })
          : await api.unlockStash({ title, password });
      saveSession({ token: result.token, title: result.stash.title });
      navigate('/stash');
    } catch (err) {
      if (err instanceof ApiError) {
        setError({ message: err.message, titleTaken: err.code === 'TITLE_TAKEN' });
      } else {
        setError({ message: 'Something went wrong. Please try again.' });
      }
    } finally {
      setBusy(false);
    }
  }

  const tab = (value: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      id={`${ids}-${value}-tab`}
      aria-selected={mode === value}
      aria-controls={`${ids}-panel`}
      className="segment"
      onClick={() => switchMode(value)}
    >
      {label}
    </button>
  );

  return (
    <section aria-label="Open or create a stash" className="mt-8">
      <div role="tablist" aria-label="What do you want to do?" className="segmented">
        {tab('open', 'Open')}
        {tab('create', 'Create')}
      </div>

      <form
        id={`${ids}-panel`}
        role="tabpanel"
        aria-labelledby={`${ids}-${mode}-tab`}
        onSubmit={handleSubmit}
        className="mt-6 space-y-5"
        noValidate
      >
        <div>
          <label htmlFor={`${ids}-title`} className="mb-2 block text-[13px] text-ink-2">
            Title
          </label>
          <input
            id={`${ids}-title`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            minLength={mode === 'create' ? 3 : 1}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. trip-photos"
            className="field"
          />
        </div>

        <div>
          <label htmlFor={`${ids}-password`} className="mb-2 block text-[13px] text-ink-2">
            Password
          </label>
          <div className="relative">
            <input
              id={`${ids}-password`}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === 'create' ? 6 : 1}
              maxLength={128}
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              placeholder={mode === 'create' ? 'At least 6 characters' : 'Password'}
              className="field pr-16"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-2 right-2 rounded-md px-2.5 text-[13px] text-muted transition-colors hover:bg-line hover:text-ink"
              aria-pressed={showPassword}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {mode === 'create' && (
          <>
            <DurationPicker legend="Delete after" value={duration} onChange={setDuration} />

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line px-4 py-3.5">
              <span>
                <span className="block text-[15px] text-ink">Burn after read</span>
                <span className="mt-0.5 block text-[13px] text-muted">
                  Delete the stash 10 minutes after the first download.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={burnAfterRead}
                onChange={(e) => setBurnAfterRead(e.target.checked)}
                className="switch"
              />
            </label>
          </>
        )}

        {error && (
          <Alert>
            <p>{error.message}</p>
            {error.titleTaken && (
              <button
                type="button"
                onClick={() => switchMode('open')}
                className="mt-1.5 rounded text-ink underline underline-offset-4"
              >
                Open that stash instead
              </button>
            )}
          </Alert>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={busy} className="mt-1 disabled:cursor-wait">
          {mode === 'create' ? (busy ? 'Creating stash…' : 'Create stash') : busy ? 'Opening stash…' : 'Open stash'}
        </Button>
      </form>
    </section>
  );
}
