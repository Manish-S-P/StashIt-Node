import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'tinted' | 'secondary' | 'ghost' | 'danger' | 'dangerQuiet' | 'burn';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-line-strong bg-field text-ink hover:border-[#3a3a40] hover:bg-[#1c1c20]',
  ghost: 'text-ink-2 hover:bg-field hover:text-ink',
  /** Lime, but quieter than primary: for frequent important actions like Download. */
  tinted: 'border border-accent/30 bg-accent/10 text-accent hover:border-accent/50 hover:bg-accent/15',
  /** Solid red: the final "yes, delete it" button. */
  danger: 'bg-error text-on-accent hover:brightness-110',
  /** Red but light: buttons that start a delete (the trash icon). */
  dangerQuiet: 'text-error/80 hover:bg-error-soft hover:text-error',
  burn: 'bg-amber text-on-primary hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 rounded-lg px-3 text-sm',
  md: 'h-10 rounded-lg px-4 text-sm',
  lg: 'h-12 w-full rounded-[10px] px-4 text-[15px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}

/** An error the user should read right away. */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-[10px] border border-error/20 bg-error-soft px-4 py-3 text-sm text-error">
      {children}
    </div>
  );
}
