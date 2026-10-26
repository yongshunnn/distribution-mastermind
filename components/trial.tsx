'use client';

import { useActionState } from 'react';
import { startTrial, type TrialState } from '@/app/actions/trial';

/** Entry form on the login page. */
export function TrialEntry({ askEmail }: { askEmail: boolean }) {
  const [state, action, pending] = useActionState<TrialState | null, FormData>(startTrial, null);
  return (
    <form action={action} className="space-y-3" data-testid="trial-entry">
      {askEmail ? (
        <label className="block space-y-1">
          <span className="text-sm font-medium">Work email (no email is sent)</span>
          <input name="email" type="email" required autoComplete="email" inputMode="email" className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" />
        </label>
      ) : null}
      <button disabled={pending} className="min-h-11 w-full rounded-lg border border-primary text-sm font-medium text-primary">
        {pending ? 'Opening…' : 'Try trial mode with sample data'}
      </button>
      {state?.error ? <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

/** One-click switch for people already signed in (sidebar / More page). */
export function TrialSwitchOn() {
  const [state, action, pending] = useActionState<TrialState | null, FormData>(startTrial, null);
  return (
    <form action={action}>
      <button disabled={pending} className="min-h-11 w-full rounded-lg border border-border px-3 text-left text-sm hover:bg-muted">
        {pending ? 'Opening…' : 'Switch to trial mode'}
        <span className="block text-xs text-muted-foreground">Sample data; your live data is untouched</span>
      </button>
      {state?.error ? <p className="mt-1 text-xs text-danger">{state.error}</p> : null}
    </form>
  );
}
