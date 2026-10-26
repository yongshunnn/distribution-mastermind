// Store-audit analytics (spec §10): price per L/kg, price bands, mainstream cluster, shares.
import { calc, leaf, type Traced } from './traced';

export interface Observation {
  id: string;
  brand: string;
  owner?: string | null;
  pack_size: number;
  pack_unit: string; // ml | l | g | kg
  price: number;
  currency: string;
  facings?: number | null;
  origin?: 'local' | 'imported' | null;
  attributes?: Record<string, unknown> | null;
  outlet_name?: string | null;
  outlet_tier?: string | null;
  observed_on?: string | null;
}

export const BANDS = ['economy', 'mainstream', 'premium', 'super-premium'] as const;
export type Band = (typeof BANDS)[number];

/** Pack size in litres (liquids) or kilograms (powders). */
export function sizeInBase(size: number, unit: string): { qty: number; base: 'L' | 'kg' } {
  const u = unit.toLowerCase();
  if (u === 'ml') return { qty: size / 1000, base: 'L' };
  if (u === 'l') return { qty: size, base: 'L' };
  if (u === 'g') return { qty: size / 1000, base: 'kg' };
  return { qty: size, base: 'kg' };
}

export function pricePerBase(o: Observation): number {
  const { qty } = sizeInBase(o.pack_size, o.pack_unit);
  return qty > 0 ? o.price / qty : 0;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Band by multiple of the median price per L/kg. */
export function bandOf(ppb: number, med: number): Band {
  if (med <= 0) return 'mainstream';
  const r = ppb / med;
  if (r < 0.75) return 'economy';
  if (r <= 1.33) return 'mainstream';
  if (r <= 2) return 'premium';
  return 'super-premium';
}

/**
 * Mainstream cluster = the price window (± widthPct around a centre) holding the most SKUs.
 * widthPct is adjustable from the UI.
 */
export function mainstreamCluster(ppbs: number[], widthPct = 12.5): { low: number; high: number; count: number } {
  const s = [...ppbs].filter((x) => x > 0).sort((a, b) => a - b);
  let best = { low: 0, high: 0, count: 0 };
  for (const centre of s) {
    const low = centre * (1 - widthPct / 100);
    const high = centre * (1 + widthPct / 100);
    const inWindow = s.filter((x) => x >= low && x <= high);
    if (inWindow.length > best.count) best = { low: inWindow[0], high: inWindow[inWindow.length - 1], count: inWindow.length };
  }
  return best;
}

export interface AuditSummary {
  n: Traced;
  base: 'L' | 'kg';
  priceLow: Traced;
  priceHigh: Traced;
  priceMedian: Traced;
  clusterLow: Traced;
  clusterHigh: Traced;
  bands: { band: Band; count: Traced; share: Traced }[];
  localShare: Traced | null;
  attributeShares: { attribute: string; option: string; share: Traced }[];
  facingShares: { brand: string; share: Traced }[];
}

export function auditSummary(obs: Observation[], currency: string, opts: { clusterWidthPct?: number; sourceLabel?: string } = {}): AuditSummary | null {
  if (!obs.length) return null;
  const src = { label: opts.sourceLabel ?? `Store audit (${obs.length} observations)` };
  const base = sizeInBase(obs[0].pack_size, obs[0].pack_unit).base;
  const ppbs = obs.map(pricePerBase);
  const u = `${currency}/${base}`;
  const m = (key: string, v: number, label: string, unit = u) => leaf(key, v, unit, { tag: 'measured', label, source: src, meaning: label });
  const n = m('audit_n', obs.length, 'SKUs observed', 'count');
  const med = median(ppbs);
  const cl = mainstreamCluster(ppbs, opts.clusterWidthPct);
  const bands = BANDS.map((band) => {
    const c = ppbs.filter((p) => bandOf(p, med) === band).length;
    const count = m(`band_${band}`, c, `${band} SKUs`, 'count');
    return { band, count, share: calc(`band_${band}_share`, c / obs.length, '%', 'SKUs in band ÷ SKUs observed', [count, n], { label: `${band} share`, meaning: `Share of observed SKUs in the ${band} price band.` }) };
  });
  const withOrigin = obs.filter((o) => o.origin);
  const local = withOrigin.filter((o) => o.origin === 'local').length;
  const localShare = withOrigin.length
    ? calc('local_share', local / withOrigin.length, '%', 'local SKUs ÷ SKUs with origin recorded', [m('local_n', local, 'Local SKUs', 'count'), m('origin_n', withOrigin.length, 'SKUs with origin', 'count')], { label: 'Local share', meaning: 'Share of SKUs made locally (vs imported).' })
    : null;
  const attributeShares: AuditSummary['attributeShares'] = [];
  const attrKeys = new Set(obs.flatMap((o) => Object.keys(o.attributes ?? {})));
  for (const a of attrKeys) {
    const vals = obs.map((o) => (o.attributes ?? {})[a]).filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (!vals.length) continue;
    const counts = new Map<string, number>();
    vals.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    for (const [value, c] of [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5)) {
      attributeShares.push({ attribute: a, option: value, share: calc(`attr_${a}_${value}`, c / vals.length, '%', `SKUs with ${a} = ${value} ÷ SKUs with ${a} recorded`, [m(`attr_${a}_${value}_n`, c, `${value} SKUs`, 'count')], { label: `${a}: ${value}`, meaning: `Share of SKUs whose ${a} is ${value}.` }) });
    }
  }
  const totalFacings = obs.reduce((s, o) => s + (o.facings ?? 0), 0);
  const byBrand = new Map<string, number>();
  obs.forEach((o) => byBrand.set(o.brand, (byBrand.get(o.brand) ?? 0) + (o.facings ?? 0)));
  const facingShares = totalFacings
    ? [...byBrand.entries()].sort((a, b) => b[1] - a[1]).map(([brand, f]) => ({ brand, share: calc(`facings_${brand}`, f / totalFacings, '%', 'brand facings ÷ all facings', [m(`facings_${brand}_n`, f, `${brand} facings`, 'facings')], { label: `${brand} shelf share`, meaning: 'Share of observed facings.' }) }))
    : [];
  return {
    n,
    base,
    priceLow: m('price_low', Math.min(...ppbs), `Lowest price per ${base}`),
    priceHigh: m('price_high', Math.max(...ppbs), `Highest price per ${base}`),
    priceMedian: m('price_median', med, `Median price per ${base}`),
    clusterLow: m('cluster_low', cl.low, 'Mainstream cluster — low'),
    clusterHigh: m('cluster_high', cl.high, 'Mainstream cluster — high'),
    bands,
    localShare,
    attributeShares,
    facingShares,
  };
}
