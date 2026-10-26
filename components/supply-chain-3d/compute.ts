import { CHAIN_STAGES, chainLayers, playEconomics, type ChainLayer, type ChainStage, type PlayInputs } from '@/lib/calc/play';
import { calc, leaf, sum, type Traced } from '@/lib/calc/traced';
import type { Branch, UnitMode } from './types';

export interface SliderState {
  freightMult?: number;
  dutyRate?: number;
  channelMargin?: number;
  stockDays?: number;
}

export interface BranchModel {
  branch: Branch;
  layers: ChainLayer[];
  volume: Traced;
  stock: Traced;
  shelf: Traced;
  C: Traced;
  /** Per-stage total of the layers added there (what tapping a mockup shows). */
  stageTotals: Partial<Record<ChainStage, Traced>>;
}

function scaleFactor(b: Branch, mode: UnitMode): Traced | null {
  if (mode === 'unit') return null;
  if (mode === 'carton') return leaf('units_per_carton', b.unitsPerCarton, 'units', { tag: 'measured', label: 'Units per carton', source: { label: 'Pack levels' } });
  if (mode === 'litre') return leaf('litres_per_unit', b.sizeLitres > 0 ? 1 / b.sizeLitres : 0, 'units/L', { tag: 'measured', label: 'Units per litre', source: { label: 'SKU size' } });
  const v = b.inputs.volume_per_unit_m3.value;
  return calc('units_per_m3', v > 0 ? 1 / v : 0, 'units/m³', '1 ÷ volume per unit', [b.inputs.volume_per_unit_m3], { label: 'Units per m³' });
}

const UNIT_SUFFIX: Record<UnitMode, string> = { unit: '/unit', litre: '/L', carton: '/carton', m3: '/m³' };

/** Applies slider overrides, recomputes the play with the pure engine and rescales layers to the chosen unit. */
export function modelBranch(b: Branch, s: SliderState, mode: UnitMode): BranchModel {
  const i: PlayInputs = { ...b.inputs };
  const touched = (t: Traced, value: number): Traced => ({ ...t, value, tag: 'estimated', note: 'Slider value (what-if, not saved).' });
  if (s.freightMult !== undefined) i.freight_per_unit = touched(i.freight_per_unit, b.inputs.freight_per_unit.value * s.freightMult);
  if (s.dutyRate !== undefined) i.duty_rate = touched(i.duty_rate, s.dutyRate);
  if (s.channelMargin !== undefined) {
    if (b.ctx.distributorTier) i.distributor_margin = touched(i.distributor_margin, s.channelMargin);
    else i.retailer_margin = touched(i.retailer_margin, s.channelMargin);
  }
  if (s.stockDays !== undefined) i.stock_days = touched(i.stock_days, s.stockDays);
  const e = playEconomics(i, b.ctx);
  const f = scaleFactor(b, mode);
  const cur = b.ctx.currency;
  const scale = (t: Traced): Traced =>
    f ? calc(t.key, t.value * f.value, `${cur}${UNIT_SUFFIX[mode]}`, `${t.label ?? t.key} × ${f.label}`, [t, f], { label: t.label, meaning: t.meaning }) : t;
  const layers = chainLayers(e, i, b.ctx).map((l) => ({ ...l, t: scale(l.t) }));
  const stageTotals: Partial<Record<ChainStage, Traced>> = {};
  for (const stage of CHAIN_STAGES) {
    const parts = layers.filter((l) => l.stage === stage).map((l) => l.t);
    stageTotals[stage] = parts.length
      ? sum(`stage_${stage}`, parts[0].unit, parts, { label: `${stage} — added at this stage`, meaning: `Everything added to the price of one unit at the ${stage.toLowerCase()} stage of the ${b.channel} route.` })
      : leaf(`stage_${stage}`, 0, `${cur}${UNIT_SUFFIX[mode]}`, { tag: 'computed', label: `${stage} — added at this stage`, meaning: 'Nothing is added to the unit price at this stage for this route.' });
  }
  return {
    branch: b,
    stageTotals,
    layers,
    volume: i.q_realistic_month,
    stock: i.stock_days,
    shelf: scale(i.shelf_price),
    C: scale(e.C),
  };
}
