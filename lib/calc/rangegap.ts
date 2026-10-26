// Range-gap check (spec §10): which rival pack sizes we do not cover.

export interface SizeRef {
  size: number;
  unit: string; // ml | l | g | kg
  who: string;
}

/** Parse '450ml', '1.2kg', '3.5L', '500 ml' → { size, unit }. */
export function parseSize(s: string): { size: number; unit: string } | null {
  const m = s.trim().toLowerCase().match(/^([\d.]+)\s*(ml|l|g|kg)$/);
  if (!m) return null;
  return { size: Number(m[1]), unit: m[2] };
}

function toBase(size: number, unit: string): { qty: number; base: 'L' | 'kg' } {
  const u = unit.toLowerCase();
  if (u === 'ml') return { qty: size / 1000, base: 'L' };
  if (u === 'l') return { qty: size, base: 'L' };
  if (u === 'g') return { qty: size / 1000, base: 'kg' };
  return { qty: size, base: 'kg' };
}

export interface RangeGap {
  size: string;
  qty: number;
  base: 'L' | 'kg';
  offeredBy: string[];
}

/**
 * A rival size counts as covered when we have a size of the same base within ±tolerance (default 15%).
 * Liquids (L) and powders (kg) are compared separately.
 */
export function rangeGaps(ours: SizeRef[], rivals: SizeRef[], tolerance = 0.15): RangeGap[] {
  const o = ours.map((x) => toBase(x.size, x.unit));
  const gaps = new Map<string, RangeGap>();
  for (const r of rivals) {
    const b = toBase(r.size, r.unit);
    const covered = o.some((x) => x.base === b.base && Math.abs(x.qty - b.qty) / b.qty <= tolerance);
    if (covered) continue;
    const label = b.qty < 1 ? `${Math.round(b.qty * 1000)}${b.base === 'L' ? 'ml' : 'g'}` : `${b.qty}${b.base}`;
    const g = gaps.get(label) ?? { size: label, qty: b.qty, base: b.base, offeredBy: [] };
    if (!g.offeredBy.includes(r.who)) g.offeredBy.push(r.who);
    gaps.set(label, g);
  }
  return [...gaps.values()].sort((a, b) => (a.base === b.base ? a.qty - b.qty : a.base < b.base ? -1 : 1));
}
