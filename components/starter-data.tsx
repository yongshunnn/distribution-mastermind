'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadStarterData } from '@/app/actions/starter';

export function StarterDataButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm" data-testid="starter-data">
      <p className="font-medium">This workspace is empty.</p>
      <p className="mt-1 text-muted-foreground">
        Load the starter data: Singapore, Malaysia and Myanmar seed figures (tagged and sourced), SG KEON with illustrative SKUs and plays, stage templates,
        partner roles and benchmarks. Everything stays editable.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await loadStarterData();
          setMsg(r.message);
          router.refresh();
        })}
        className="mt-3 min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? 'Loading…' : 'Load starter data'}
      </button>
      {msg ? <p className="mt-2" role="status">{msg}</p> : null}
    </div>
  );
}
