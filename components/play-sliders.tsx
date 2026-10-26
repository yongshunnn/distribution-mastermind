'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { playEconomics, type PlayContext, type PlayInputKey, type PlayInputs } from '@/lib/calc/play';
import { saveWhatIf } from '@/app/actions/plays';
import { Num } from './num';

export const SLIDER_KEYS: PlayInputKey[] = ['shelf_price', 'retailer_margin', 'distributor_margin', 'supplier_price', 'freight_per_unit', 'duty_rate', 'stock_days', 'q_realistic_month', 'marketing_per_unit'];

function range(key: PlayInputKey, v: number, unit: string): { min: number; max: number; step: number } {
  if (unit === '%') return { min: 0, max: Math.max(0.6, v * 2), step: 0.005 };
  if (unit === 'days') return { min: 0, max: Math.max(180, v * 2), step: 1 };
  if (key === 'q_realistic_month') return { min: 0, max: Math.max(1000, v * 3), step: Math.max(1, Math.round(v / 100)) };
  const max = Math.max(v * 2, 1);
  return { min: 0, max, step: Math.max(max / 200, 0.01) };
}

/** Live what-if (spec §4 Play detail, §11.1 sliders): recomputes with the same pure engine in the browser. */
export function PlaySliders({ playId, inputs, ctx, keys = SLIDER_KEYS }: { playId: string; inputs: PlayInputs; ctx: PlayContext; keys?: PlayInputKey[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [vals, setVals] = useState<Partial<Record<PlayInputKey, number>>>({});
  const active = keys.filter((k) => !(k === 'distributor_margin' && !ctx.distributorTier));
  const changed = Object.keys(vals).length > 0;
  const live = useMemo(() => {
    const next = { ...inputs };
    for (const [k, v] of Object.entries(vals)) next[k as PlayInputKey] = { ...next[k as PlayInputKey], value: v as number, tag: 'estimated', note: 'What-if slider value (not saved).' };
    return playEconomics(next, ctx);
  }, [vals, inputs, ctx]);

  return (
    <div className="space-y-4" data-testid="play-sliders">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Contribution / unit</p><Num t={live.C} size="lg" /></div>
        <div><p className="text-xs text-muted-foreground">Per month</p><Num t={live.perMonth} /></div>
        <div><p className="text-xs text-muted-foreground">Headroom</p><Num t={live.headroom} /></div>
        <div><p className="text-xs text-muted-foreground">Return on cash</p><Num t={live.R} /></div>
      </div>
      <ul className="space-y-3">
        {active.map((k) => {
          const t = inputs[k];
          const v = vals[k] ?? t.value;
          const r = range(k, t.value, t.unit);
          const shown = { ...t, value: v, tag: vals[k] !== undefined ? ('estimated' as const) : t.tag };
          return (
            <li key={k}>
              <label className="block">
                <span className="flex items-baseline justify-between gap-2 text-sm">
                  <span>{t.label}</span>
                  <Num t={shown} />
                </span>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={v}
                  onChange={(e) => setVals((s) => ({ ...s, [k]: Number(e.target.value) }))}
                  className="h-11 w-full accent-[var(--primary)]"
                  aria-label={t.label}
                />
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!changed} onClick={() => setVals({})} className="min-h-11 rounded-lg border border-border px-4 text-sm disabled:opacity-50">Reset</button>
        <button
          type="button"
          disabled={!changed || pending}
          onClick={() =>
            start(async () => {
              await saveWhatIf(playId, Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, { value: v as number, unit: inputs[k as PlayInputKey].unit, label: inputs[k as PlayInputKey].label }])));
              setVals({});
              router.refresh();
            })
          }
          className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save as play overrides'}
        </button>
      </div>
    </div>
  );
}
