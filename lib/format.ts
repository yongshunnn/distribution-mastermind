// Number formatting. Only components/num.tsx and components/explain-card.tsx may call these
// (enforced by tests/unit/no-raw-numbers.test.ts).
import type { Traced } from '@/lib/calc/traced';

const CURRENCY = /^([A-Z]{3})(\/.*)?$/;

function grouped(v: number, digits: number): string {
  return v.toLocaleString('en-SG', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function compact(v: number): string | null {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(a >= 1e10 ? 1 : 2).replace(/\.?0+$/, '')}bn`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}m`;
  return null;
}

export interface Formatted {
  text: string;
  suffix?: string;
}

export function formatValue(value: number, unit: string): Formatted {
  if (!Number.isFinite(value)) return { text: '—' };
  if (unit === '%') {
    const pct = value * 100;
    const d = Math.abs(pct) < 10 && pct % 1 !== 0 ? 1 : Math.abs(pct) >= 100 ? 0 : pct % 1 === 0 ? 0 : 1;
    return { text: `${pct.toFixed(d)}%` };
  }
  if (unit === 'pct') return { text: `${Number(value.toFixed(2))}%` };
  if (unit === 'flag') return { text: value >= 0.5 ? 'Yes' : 'No' };
  if (unit === 'score') return { text: value.toFixed(0), suffix: '/100' };
  if (unit === 'count') return { text: grouped(value, 0) };
  const m = unit.match(CURRENCY);
  if (m && /^[A-Z]{3}\/[A-Z]{3}$/.test(unit)) return { text: value.toPrecision(4), suffix: unit };
  if (m) {
    const a = Math.abs(value);
    const c = compact(value);
    const text = c ?? (a >= 1000 ? grouped(value, 0) : a >= 100 ? grouped(value, 1) : grouped(value, 2));
    return { text: `${m[1]} ${text}`, suffix: m[2] };
  }
  if (unit === 'm³') return { text: value < 0.1 ? value.toPrecision(3) : grouped(value, 2), suffix: 'm³' };
  const c = compact(value);
  const a = Math.abs(value);
  const text = c ?? (Number.isInteger(value) || a >= 100 ? grouped(value, 0) : a >= 10 ? grouped(value, 1) : grouped(value, 2));
  return { text, suffix: unit || undefined };
}

/** True minus sign for negatives (reads better than a hyphen). */
function minus(f: Formatted): Formatted {
  return { ...f, text: f.text.replace(/(^|\s)-(?=\d)/, '$1−') };
}

export function formatTraced(t: Pick<Traced, 'value' | 'unit' | 'na'>): Formatted {
  if (t.na) return { text: 'n/a' };
  return minus(formatValue(t.value, t.unit));
}

export function formatPlain(value: number, unit: string): string {
  const f = minus(formatValue(value, unit));
  return f.suffix ? `${f.text} ${f.suffix.replace(/^\//, '/ ')}`.replace('/ ', '/') : f.text;
}

export function formatDelta(value: number, unit: string): string {
  const f = formatPlain(Math.abs(value), unit);
  return `${value >= 0 ? '+' : '−'}${f}`;
}
