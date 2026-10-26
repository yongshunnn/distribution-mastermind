// Small shadcn-style primitives (hand-written; no generator needed).
import Link from 'next/link';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ComponentProps, ReactNode } from 'react';

export function cn(...x: Parameters<typeof clsx>) {
  return twMerge(clsx(...x));
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-border bg-card p-4 shadow-sm', className)} {...p} />;
}

export function CardTitle({ className, ...p }: ComponentProps<'h2'>) {
  return <h2 className={cn('mb-3 text-sm font-semibold tracking-tight text-foreground', className)} {...p} />;
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-primary';
const variants = {
  primary: 'bg-primary text-primary-foreground hover:opacity-90',
  secondary: 'border border-border bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
  danger: 'bg-danger text-white hover:opacity-90',
};

export function Button({ className, variant = 'primary', ...p }: ComponentProps<'button'> & { variant?: keyof typeof variants }) {
  return <button className={cn(buttonBase, variants[variant], className)} {...p} />;
}

export function ButtonLink({ className, variant = 'secondary', ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof variants }) {
  return <Link className={cn(buttonBase, variants[variant], className)} {...p} />;
}

const badgeTones = {
  neutral: 'bg-muted text-muted-foreground',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-accent text-primary',
};

export function Badge({ className, tone = 'neutral', ...p }: ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', badgeTones[tone], className)} {...p} />;
}

const field = 'w-full min-h-11 rounded-lg border border-border bg-card px-3 text-base sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-2 focus:outline-primary';

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input className={cn(field, className)} {...p} />;
}

export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cn(field, 'pr-8', className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={cn(field, 'min-h-20 py-2', className)} {...p} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block space-y-1', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-4 space-y-1">
      {back ? (
        <Link href={back.href} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav aria-label="Sections" className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center border-b-2 px-3 text-sm whitespace-nowrap',
                t.key === active ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      {children ? <div className="mt-2 text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function KV({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
      <dt className="min-w-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

export function Notice({ tone = 'warn', children }: { tone?: 'warn' | 'danger' | 'info' | 'ok'; children: ReactNode }) {
  const tones = { warn: 'bg-warn-bg text-warn', danger: 'bg-danger-bg text-danger', info: 'bg-accent text-primary', ok: 'bg-ok-bg text-ok' };
  return <div className={cn('rounded-lg px-3 py-2 text-sm', tones[tone])}>{children}</div>;
}
