'use client';

import { useActionState } from 'react';
import { sendMagicLink, type LoginState } from './actions';

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState | null, FormData>(sendMagicLink, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block space-y-1">
        <span className="text-sm font-medium">Work email</span>
        <input name="email" type="email" required autoComplete="email" inputMode="email" className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base" />
      </label>
      <button disabled={pending} className="min-h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground">
        {pending ? 'Sending…' : 'Email me a sign-in link'}
      </button>
      {state?.message ? <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok">{state.message}</p> : null}
      {state?.error ? <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
