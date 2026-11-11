import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function Wordmark() {
  return (
    <Link
      to="/"
      className="shrink-0 rounded font-serif text-[22px] leading-none tracking-tight text-ink"
      aria-label="StashIT home"
    >
      StashIT
    </Link>
  );
}

/** The thin top bar shared by both pages. */
export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        {children}
      </div>
    </header>
  );
}
