import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ClockIcon, FlameIcon, LockIcon } from './icons';

export type GoneReason = 'expired' | 'burned' | 'session';

const COPY: Record<GoneReason, { title: string; body: string; icon: ReactNode; tile: string }> = {
  expired: {
    title: 'This stash is gone',
    body: 'It expired or was deleted, and its files are no longer stored.',
    icon: <ClockIcon />,
    tile: 'border-line bg-field text-ink-2',
  },
  burned: {
    title: 'This stash was burned',
    body: 'Someone downloaded from it first, so it is closed to everyone else and will be deleted shortly.',
    icon: <FlameIcon />,
    tile: 'border-amber/25 bg-amber-soft text-amber',
  },
  session: {
    title: 'Your session ended',
    body: 'For safety, access lasts 2 hours. Open the stash again with its title and password.',
    icon: <LockIcon />,
    tile: 'border-line bg-field text-ink-2',
  },
};

export function GoneState({ reason }: { reason: GoneReason }) {
  const copy = COPY[reason];
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-line bg-surface p-8 text-center">
      <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full border text-2xl ${copy.tile}`}>
        {copy.icon}
      </span>
      <h1 className="mt-5 font-serif text-[28px] leading-tight tracking-tight">{copy.title}</h1>
      <p className="mt-2 text-[15px] text-muted">{copy.body}</p>
      <Link
        to="/"
        className="mt-7 inline-flex h-11 items-center rounded-[10px] bg-accent px-5 text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
      >
        Back to start
      </Link>
    </div>
  );
}
