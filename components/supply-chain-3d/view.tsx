'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { leaf, type Traced } from '@/lib/calc/traced';
import { KIND_LABEL, LAYER_COLOR } from '@/lib/layers';
import { CHAIN_STAGES } from '@/lib/calc/play';
import { Factory, Landmark, Plane, Ship, Store, Truck, User, UtensilsCrossed, Warehouse, type LucideIcon } from 'lucide-react';
import { ExplainCard } from '../explain-card';
import { Num } from '../num';
import { Waterfall } from '../waterfall';
import { modelBranch, type SliderState } from './compute';
import type { Branch, UnitMode } from './types';

const ChainScene = dynamic(() => import('./scene'), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted-foreground">Loading 3D…</div>,
});

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Factory-to-consumer view with a 3D staircase and a 2D waterfall fallback (spec §11). */
export function SupplyChainView({ branches }: { branches: Branch[] }) {
  const [mode, setMode] = useState<'3d' | '2d' | null>(null);
  const [canWebgl, setCanWebgl] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [unit, setUnit] = useState<UnitMode>('unit');
  const [compare, setCompare] = useState<string[]>([]);
  const [sliders, setSliders] = useState<SliderState>({});
  const [selected, setSelected] = useState<Traced | null>(null);

  useEffect(() => {
    const ok = webglAvailable();
    setCanWebgl(ok);
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const lowPower = mem !== undefined && mem < 4;
    setMode(ok && !lowPower ? '3d' : '2d');
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  const shown = compare.length === 2 ? branches.filter((b) => compare.includes(b.id)) : branches;
  const models = useMemo(() => shown.map((b) => modelBranch(b, sliders, unit)), [shown, sliders, unit]);
  const anyTier = branches.some((b) => b.ctx.distributorTier);
  const pill = (active: boolean) => `min-h-11 rounded-lg border px-3 text-sm ${active ? 'border-primary bg-accent font-medium' : 'border-border'}`;

  if (!branches.length) return <p className="text-sm text-muted-foreground">No plays for this selection yet.</p>;

  return (
    <div className="space-y-4" data-testid="supply-chain">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="View" className="flex gap-1">
          <button type="button" className={pill(mode === '3d')} disabled={!canWebgl} onClick={() => setMode('3d')}>3D chain</button>
          <button type="button" className={pill(mode === '2d')} onClick={() => setMode('2d')}>2D waterfall</button>
          <button type="button" className={`${pill(false)} opacity-50`} disabled title="Geographic globe — coming later (spec §11.2)">Globe (coming)</button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Unit
          <select value={unit} onChange={(e) => setUnit(e.target.value as UnitMode)} className="min-h-11 rounded-lg border border-border bg-card px-2">
            <option value="unit">per unit</option>
            <option value="litre">per litre</option>
            <option value="carton">per carton</option>
            <option value="m3">per m³</option>
          </select>
        </label>
        {!canWebgl ? <span className="text-xs text-muted-foreground">WebGL unavailable — showing 2D.</span> : null}
      </div>

      {branches.length > 2 ? (
        <fieldset className="text-sm">
          <legend className="mb-1 text-xs text-muted-foreground">Compare two routes side by side (pick two, or none for all)</legend>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <label key={b.id} className={pill(compare.includes(b.id)) + ' inline-flex items-center gap-2'}>
                <input
                  type="checkbox"
                  className="size-4"
                  checked={compare.includes(b.id)}
                  onChange={(e) => setCompare((c) => (e.target.checked ? [...c, b.id].slice(-2) : c.filter((x) => x !== b.id)))}
                />
                {b.title}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <StageStrip branches={shown} />

      {mode === '3d' ? (
        <div className="h-[60vh] min-h-80 overflow-hidden rounded-xl border border-border bg-card" aria-label="3D supply chain. Tap a layer, tube or footprint for its explanation. The same values are listed below.">
          <ChainScene models={models} onSelect={setSelected} reducedMotion={reducedMotion} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs" aria-label="Legend">
        {(Object.keys(KIND_LABEL) as (keyof typeof KIND_LABEL)[]).filter((k) => k !== 'retail_margin').map((k) => (
          <span key={k} className="flex items-center gap-1"><span className="size-3 rounded-sm" style={{ background: LAYER_COLOR[k] }} aria-hidden="true" />{KIND_LABEL[k]}</span>
        ))}
        <span className="text-muted-foreground">Tube thickness = monthly volume · footprint = stock days · tap a building or vehicle for the cost added at that stage</span>
      </div>

      <section className="rounded-xl border border-border bg-card p-4" aria-label="Sliders">
        <h2 className="mb-2 text-sm font-semibold">What-if — restacks live</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Slider label="Freight (× current)" value={sliders.freightMult ?? 1} min={0} max={3} step={0.05} unit="×" onChange={(v) => setSliders((s) => ({ ...s, freightMult: v }))} />
          <Slider label="Duty rate" value={sliders.dutyRate ?? 0} min={0} max={0.3} step={0.005} unit="%" onChange={(v) => setSliders((s) => ({ ...s, dutyRate: v }))} untouched={sliders.dutyRate === undefined} />
          <Slider label={anyTier ? 'Channel / distributor margin' : 'Channel margin'} value={sliders.channelMargin ?? 0.3} min={0} max={0.6} step={0.005} unit="%" onChange={(v) => setSliders((s) => ({ ...s, channelMargin: v }))} untouched={sliders.channelMargin === undefined} />
          <Slider label="Stock days" value={sliders.stockDays ?? 45} min={0} max={180} step={1} unit="days" onChange={(v) => setSliders((s) => ({ ...s, stockDays: v }))} untouched={sliders.stockDays === undefined} />
        </div>
        <button type="button" onClick={() => setSliders({})} className="mt-2 min-h-11 rounded-lg border border-border px-4 text-sm">Reset to saved values</button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {models.map((m) => (
          <section key={m.branch.id} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{m.branch.title} <span className="font-normal text-muted-foreground">· {m.branch.market}</span></h3>
              <span className="text-sm">Contribution <Num t={m.C} /></span>
            </div>
            {mode === '2d' ? <Waterfall layers={m.layers} height={200} /> : (
              <ul className="divide-y divide-border text-sm">
                {m.layers.filter((l) => Math.abs(l.t.value) > 1e-9).map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-1">
                    <span className="flex min-w-0 items-center gap-2"><span className="size-3 shrink-0 rounded-sm" style={{ background: LAYER_COLOR[l.kind] }} aria-hidden="true" /><span className="truncate">{l.t.label}</span><span className="hidden text-xs text-muted-foreground sm:inline">· {l.stage}</span></span>
                    <Num t={l.t} />
                  </li>
                ))}
                <li className="flex justify-between py-1"><span>Monthly volume</span><Num t={m.volume} /></li>
                <li className="flex justify-between py-1"><span>Stock days</span><Num t={m.stock} /></li>
              </ul>
            )}
          </section>
        ))}
      </div>

      <Dialog.Root open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content aria-describedby={undefined} className="sheet-in fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-card p-4 shadow-xl sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[28rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <Dialog.Title className="sr-only">{selected?.label}</Dialog.Title>
            {selected ? <ExplainCard t={selected} onClose={() => setSelected(null)} /> : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

/** Icon strip naming each stage of the chain (shown in both 2D and 3D views). */
function StageStrip({ branches }: { branches: Branch[] }) {
  const freight = new Set(branches.map((b) => b.freight));
  const food = branches.some((b) => b.outletKind === 'food');
  const icons: Record<string, LucideIcon[]> = {
    Production: [Factory],
    'Origin logistics': [Truck],
    'Main freight': [...(freight.has('ship') ? [Ship] : []), ...(freight.has('plane') ? [Plane] : []), ...(freight.has('truck') ? [Truck] : [])],
    Import: [Landmark],
    Warehouse: [Warehouse],
    'Delivery to channel': [Truck],
    Channel: [Store],
    'Outlet / end user': food ? [UtensilsCrossed, Store] : [Store],
    Consumer: [User],
  };
  return (
    <ol className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1" aria-label="Supply-chain stages" data-testid="stage-strip">
      {CHAIN_STAGES.map((stage, i) => (
        <li key={stage} className="flex shrink-0 items-center gap-1">
          <span className="flex w-20 flex-col items-center gap-1 rounded-lg border border-border bg-card px-1 py-2 text-center">
            <span className="flex gap-0.5 text-primary" aria-hidden="true">
              {icons[stage].map((Icon, k) => <Icon key={k} size={18} />)}
            </span>
            <span className="text-[10px] leading-tight text-muted-foreground">{stage}</span>
          </span>
          {i < CHAIN_STAGES.length - 1 ? <span aria-hidden="true" className="text-muted-foreground">›</span> : null}
        </li>
      ))}
    </ol>
  );
}

function Slider({ label, value, min, max, step, unit, onChange, untouched }: { label: string; value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; untouched?: boolean }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between gap-2">
        <span>{label}</span>
        {untouched ? <span className="text-muted-foreground">saved values</span> : <Num t={leaf('slider', value, unit, { tag: 'estimated', label, meaning: 'What-if slider position applied to every route shown. Not saved.' })} />}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-[var(--primary)]" aria-label={label} />
    </label>
  );
}
