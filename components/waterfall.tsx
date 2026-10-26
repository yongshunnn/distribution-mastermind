'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { ChainLayer } from '@/lib/calc/play';
import type { Traced } from '@/lib/calc/traced';
import { KIND_LABEL, LAYER_COLOR, stack } from '@/lib/layers';
import { ExplainCard } from './explain-card';
import { Num } from './num';

/** 2D price waterfall: each bar is one cost layer, rising from zero to the shelf price. Tap a bar for its explanation. */
export function Waterfall({ layers, height = 260 }: { layers: ChainLayer[]; height?: number }) {
  const [open, setOpen] = useState<Traced | null>(null);
  const stacked = stack(layers);
  const data = stacked.map((s, i) => ({ i, name: s.layer.t.label ?? s.layer.kind, base: s.bottom, size: s.top - s.bottom, kind: s.layer.kind, t: s.layer.t }));
  return (
    <div>
      <div style={{ height }} role="img" aria-label="Price waterfall from supplier price to shelf price. Values are listed below the chart.">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <XAxis dataKey="i" tick={false} axisLine={{ stroke: 'var(--border)' }} tickLine={false} height={4} />
            <YAxis hide domain={[0, 'dataMax']} />
            <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="size" stackId="w" isAnimationActive={false} radius={[3, 3, 0, 0]} onClick={(d) => setOpen((d as unknown as { payload: { t: Traced } }).payload.t)} cursor="pointer">
              {data.map((d) => (
                <Cell key={d.i} fill={LAYER_COLOR[d.kind]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ol className="mt-2 divide-y divide-border text-sm" data-testid="waterfall-layers">
        {stacked.map((s, i) => (
          <li key={i} className="flex items-center justify-between gap-2 py-1.5">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-3 shrink-0 rounded-sm" style={{ background: LAYER_COLOR[s.layer.kind] }} aria-hidden="true" />
              <span className="truncate">{s.layer.t.label}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">· {s.layer.stage} · {KIND_LABEL[s.layer.kind]}</span>
            </span>
            <Num t={s.layer.t} />
          </li>
        ))}
      </ol>
      <Dialog.Root open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content aria-describedby={undefined} className="sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <Dialog.Title className="sr-only">{open?.label}</Dialog.Title>
            {open ? <ExplainCard t={open} onClose={() => setOpen(null)} /> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
