'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { addObservation } from '@/app/actions/competition';
import type { ActionState } from '@/app/actions/values';

type MarketOpt = { id: string; name: string; currency: string };
type AreaOpt = { id: string; name: string; market_id: string };
const QUEUE_KEY = 'dm-audit-queue';

const input = 'min-h-12 w-full rounded-lg border border-border bg-card px-3 text-base';

function readQueue(): Record<string, string>[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeQueue(q: Record<string, string>[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // storage unavailable (private mode) — entries then need a connection
  }
}

export function AuditForm({ markets, areas, defaultMarket, today }: { markets: MarketOpt[]; areas: AreaOpt[]; defaultMarket?: string; today: string }) {
  const [state, action, pending] = useActionState<ActionState | null, FormData>(addObservation, null);
  const [marketId, setMarketId] = useState(defaultMarket ?? '');
  const [queued, setQueued] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  // Outlet details are controlled so they survive the form reset React performs after each action.
  const [outlet, setOutlet] = useState({ outlet_name: '', outlet_tier: 'mainstream', observed_on: today, area_id: '', category: 'dishwashing' });
  const bind = (k: keyof typeof outlet) => ({ name: k, value: outlet[k], onChange: (e: { target: { value: string } }) => setOutlet((o) => ({ ...o, [k]: e.target.value })) });
  const formRef = useRef<HTMLFormElement>(null);
  const market = markets.find((m) => m.id === marketId);

  const flush = useCallback(async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    const rest: Record<string, string>[] = [];
    for (const entry of q) {
      const fd = new FormData();
      Object.entries(entry).forEach(([k, v]) => fd.append(k, v));
      try {
        const r = await addObservation(null, fd);
        if (!r.ok) rest.push(entry);
      } catch {
        rest.push(entry);
      }
    }
    writeQueue(rest);
    setQueued(rest.length);
    if (q.length > rest.length) setNote(`Sent ${q.length - rest.length} queued entr${q.length - rest.length === 1 ? 'y' : 'ies'}.`);
  }, []);

  useEffect(() => {
    setQueued(readQueue().length);
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);

  useEffect(() => {
    if (state?.ok && formRef.current) {
      for (const name of ['brand', 'owner', 'pack_size', 'price', 'facings', 'scent', 'claim', 'photo']) {
        const el = formRef.current.elements.namedItem(name) as HTMLInputElement | null;
        if (el) el.value = '';
      }
      (formRef.current.elements.namedItem('brand') as HTMLInputElement | null)?.focus();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (navigator.onLine) return;
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const entry: Record<string, string> = {};
        fd.forEach((v, k) => {
          if (typeof v === 'string') entry[k] = v;
        });
        const q = [...readQueue(), entry];
        writeQueue(q);
        setQueued(q.length);
        setNote('Offline — saved on this phone. It will send automatically when you reconnect (photo not included).');
      }}
      className="space-y-4 pb-24"
      data-testid="audit-form"
    >
      {queued ? <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">Queued on this device: {queued} entr{queued === 1 ? 'y' : 'ies'}</p> : null}
      {note ? <p className="rounded-lg bg-accent px-3 py-2 text-sm text-primary">{note}</p> : null}

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold">Outlet</legend>
        <label className="block text-sm">Market
          <select name="market_id" value={marketId} onChange={(e) => setMarketId(e.target.value)} className={input} required>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">Outlet name<input {...bind('outlet_name')} className={input} autoComplete="off" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Tier
            <select {...bind('outlet_tier')} className={input}>
              <option value="premium">Premium</option>
              <option value="mainstream">Mainstream</option>
              <option value="convenience">Convenience</option>
              <option value="traditional">Traditional / mom-and-pop</option>
              <option value="wholesale">Wholesale</option>
            </select>
          </label>
          <label className="block text-sm">Date<input {...bind('observed_on')} type="date" className={input} required /></label>
        </div>
        <label className="block text-sm">Area
          <select {...bind('area_id')} className={input}>
            <option value="">—</option>
            {areas.filter((a) => a.market_id === marketId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">Category<input {...bind('category')} className={input} required /></label>
      </fieldset>

      <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
        <legend className="px-1 text-sm font-semibold">Product on shelf</legend>
        <label className="block text-sm">Brand<input name="brand" className={input} required autoComplete="off" /></label>
        <label className="block text-sm">Owner / maker<input name="owner" className={input} autoComplete="off" /></label>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block text-sm">Pack size<input name="pack_size" inputMode="decimal" className={input} required /></label>
          <label className="block text-sm">Unit
            <select name="pack_unit" className={input} defaultValue="ml">
              <option value="ml">ml</option><option value="l">L</option><option value="g">g</option><option value="kg">kg</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className="col-span-2 block text-sm">Shelf price<input name="price" inputMode="decimal" className={input} required /></label>
          <label className="block text-sm">Currency<input name="currency" value={market?.currency ?? ''} readOnly className={input} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Facings<input name="facings" inputMode="numeric" className={input} /></label>
          <label className="block text-sm">Origin
            <select name="origin" className={input} defaultValue="local">
              <option value="local">Local</option><option value="imported">Imported</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Scent<input name="scent" className={input} placeholder="Lemon" /></label>
          <label className="block text-sm">Claim<input name="claim" className={input} placeholder="Antibacterial" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Halal logo
            <select name="halal_logo" className={input} defaultValue="">
              <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
            </select>
          </label>
          <label className="block text-sm">Label languages<input name="label_langs" className={input} placeholder="EN, BM" /></label>
        </div>
        <label className="block text-sm">Photo<input name="photo" type="file" accept="image/*" capture="environment" className="mt-1 block w-full text-sm" /></label>
      </fieldset>

      {state?.error ? <p className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok" role="status">{state.message}</p> : null}

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-card/95 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-primary text-base font-medium text-primary-foreground md:w-auto md:px-8">
          {pending ? 'Saving…' : 'Save & next'}
        </button>
      </div>
    </form>
  );
}
