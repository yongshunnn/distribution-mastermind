// Currency conversion via fx_rates (1 base = rate quote). Base reporting currency is SGD.
import { calc, leaf, type Tag, type Traced } from './traced';

export interface FxRate {
  base: string;
  quote: string;
  rate: number;
  month: string; // ISO date, first of month
  tag?: Tag;
  source?: string | null;
}

function latest(rates: FxRate[], base: string, quote: string): FxRate | undefined {
  return rates
    .filter((r) => r.base === base && r.quote === quote)
    .sort((a, b) => (a.month < b.month ? 1 : -1))[0];
}

/** Rate to turn 1 `from` into `to`. Direct, inverse, or crossed through SGD. */
export function fxRate(from: string, to: string, rates: FxRate[]): Traced {
  const unit = `${to}/${from}`;
  if (from === to) return leaf('fx_rate', 1, unit, { tag: 'computed', label: `${from} → ${to}` });
  const direct = latest(rates, from, to);
  if (direct) {
    return leaf('fx_rate', direct.rate, unit, {
      tag: direct.tag ?? 'public',
      label: `${from} → ${to}`,
      source: { label: direct.source ?? 'fx_rates', asOf: direct.month },
    });
  }
  const inverse = latest(rates, to, from);
  if (inverse) {
    const inv = leaf('fx_rate', inverse.rate, `${from}/${to}`, {
      tag: inverse.tag ?? 'public',
      label: `${to} → ${from}`,
      source: { label: inverse.source ?? 'fx_rates', asOf: inverse.month },
    });
    return calc('fx_rate', 1 / inverse.rate, unit, `1 ÷ (${to} → ${from})`, [inv], { label: `${from} → ${to}` });
  }
  if (from !== 'SGD' && to !== 'SGD') {
    const a = fxRate(from, 'SGD', rates);
    const b = fxRate('SGD', to, rates);
    if (a.value && b.value) {
      return calc('fx_rate', a.value * b.value, unit, `(${from} → SGD) × (SGD → ${to})`, [a, b], {
        label: `${from} → ${to}`,
      });
    }
  }
  throw new Error(`No FX rate for ${from} → ${to}`);
}

export function hasFx(from: string, to: string, rates: FxRate[]): boolean {
  try {
    fxRate(from, to, rates);
    return true;
  } catch {
    return false;
  }
}

/** Convert a money amount. `unitSuffix` keeps e.g. '/unit'. */
export function convert(t: Traced, from: string, to: string, rates: FxRate[]): Traced {
  if (from === to) return t;
  const r = fxRate(from, to, rates);
  const suffix = t.unit.startsWith(from) ? t.unit.slice(from.length) : '';
  return calc(t.key, t.value * r.value, `${to}${suffix}`, `${t.label ?? t.key} × ${r.label}`, [t, r], {
    label: t.label,
    meaning: t.meaning,
  });
}

export function convertNumber(value: number, from: string, to: string, rates: FxRate[]): number {
  return value * fxRate(from, to, rates).value;
}
