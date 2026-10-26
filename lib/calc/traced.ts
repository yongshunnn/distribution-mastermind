// The Traced value: every number the UI shows carries its own explanation (spec §7.1).
import glossarySeed from '@/seed/glossary.json';

export type Tag = 'public' | 'estimated' | 'placeholder' | 'quoted' | 'measured' | 'computed';

export interface Source {
  label: string;
  url?: string;
  asOf?: string;
}

export interface Lever {
  label: string;
  inputKey: string;
  from: number;
  to: number;
  unit: string;
}

export interface HistoryEntry {
  value: number | null;
  text?: string | null;
  tag: Tag;
  source?: string | null;
  at: string;
}

export interface Traced {
  key: string;
  value: number;
  unit: string;
  meaning: string;
  label?: string;
  formula?: string;
  components?: Traced[];
  tag: Tag;
  source?: Source;
  stale?: boolean;
  sensitivity?: { inputKey: string; label?: string; deltaFor10pct: number }[];
  compare?: { label: string; value: number }[];
  /** Same value in another currency (e.g. SGD alongside MYR). */
  alt?: { value: number; unit: string };
  /** Set on leaves that come from tracked_values, so the card can offer "Edit". */
  ref?: { entityType: string; entityId: string; field: string; unit?: string | null; raw?: number | null; text?: string | null };
  /** When the value is not meaningful (e.g. break-even with negative contribution). */
  na?: string;
  note?: string;
  /** Text facts (e.g. a licence rule) shown in place of a number. */
  text?: string;
  levers?: Lever[];
  history?: HistoryEntry[];
}

// Weakest first. Computed values inherit the weakest tag among their inputs.
export const TAG_RANK: Record<Tag, number> = {
  placeholder: 0,
  estimated: 1,
  public: 2,
  quoted: 3,
  measured: 4,
  computed: 5,
};

export const TAG_LABEL: Record<Tag, string> = {
  placeholder: 'Placeholder',
  estimated: 'Estimated',
  public: 'Public source',
  quoted: 'Quoted',
  measured: 'Measured',
  computed: 'Computed',
};

export function weakestTag(tags: Tag[]): Tag {
  if (tags.length === 0) return 'computed';
  return tags.reduce((w, t) => (TAG_RANK[t] < TAG_RANK[w] ? t : w));
}

type GlossaryEntry = { key: string; label: string; meaning: string; formula_text?: string; unit?: string };
const GLOSSARY: Record<string, GlossaryEntry> = Object.fromEntries(
  (glossarySeed as GlossaryEntry[]).map((g) => [g.key, g]),
);

export function glossaryEntry(key: string): GlossaryEntry | undefined {
  return GLOSSARY[key];
}

export function meaningOf(key: string, fallback?: string): string {
  return GLOSSARY[key]?.meaning ?? fallback ?? key.replace(/_/g, ' ');
}

export function labelOf(key: string, fallback?: string): string {
  return GLOSSARY[key]?.label ?? fallback ?? key.replace(/_/g, ' ');
}

export interface LeafOpts {
  tag: Tag;
  label?: string;
  meaning?: string;
  source?: Source;
  ref?: Traced['ref'];
  note?: string;
  history?: HistoryEntry[];
}

/** A raw input. */
export function leaf(key: string, value: number, unit: string, opts: LeafOpts): Traced {
  return {
    key,
    value,
    unit,
    label: opts.label ?? labelOf(key),
    meaning: opts.meaning ?? meaningOf(key, opts.label),
    tag: opts.tag,
    source: opts.source,
    ref: opts.ref,
    note: opts.note,
    history: opts.history,
  };
}

/** A fixed constant used in a formula (365 days, 12 months). Tagged computed, so it never weakens a result. */
export function constant(key: string, value: number, unit: string, label: string): Traced {
  return { key, value, unit, label, meaning: label, tag: 'computed' };
}

export interface CalcOpts {
  label?: string;
  meaning?: string;
  na?: string;
  note?: string;
  levers?: Lever[];
}

/** A computed value. Its tag is the weakest among its components. */
export function calc(
  key: string,
  value: number,
  unit: string,
  formula: string,
  components: Traced[],
  opts: CalcOpts = {},
): Traced {
  return {
    key,
    value: Number.isFinite(value) ? value : 0,
    unit,
    label: opts.label ?? labelOf(key),
    meaning: opts.meaning ?? meaningOf(key, opts.label),
    formula,
    components,
    tag: weakestTag(components.map((c) => c.tag)),
    na: opts.na ?? (Number.isFinite(value) ? undefined : 'Not defined for these inputs'),
    note: opts.note,
    levers: opts.levers,
  };
}

/** Count of records (e.g. open checklist items). */
export function count(key: string, n: number, label: string, meaning: string): Traced {
  return { key, value: n, unit: 'count', label, meaning, tag: 'computed', formula: 'Count of matching records' };
}

/** Returns a copy with `value` replaced (used for perturbation and slider overrides). */
export function withValue(t: Traced, value: number): Traced {
  return { ...t, value };
}

/** Collect every distinct leaf (no components) reachable from t. */
export function leaves(t: Traced, acc: Map<string, Traced> = new Map()): Map<string, Traced> {
  if (!t.components || t.components.length === 0) {
    if (!acc.has(t.key)) acc.set(t.key, t);
    return acc;
  }
  for (const c of t.components) leaves(c, acc);
  return acc;
}

/** Flags leaves (and their parents) whose source date is older than thresholdDays. */
export function markStale(t: Traced, thresholdDays: number, today: Date): Traced {
  if (t.components && t.components.length > 0) {
    const components = t.components.map((c) => markStale(c, thresholdDays, today));
    return { ...t, components, stale: components.some((c) => c.stale) };
  }
  if (!t.source?.asOf) return t;
  const ageDays = (today.getTime() - new Date(t.source.asOf).getTime()) / 86_400_000;
  return { ...t, stale: ageDays > thresholdDays };
}

export type Inputs = Record<string, Traced>;

/**
 * Sensitivity (spec §8.9): nudge each input by +10% and record how much the output moves.
 * Sorted by absolute impact, largest first.
 */
export function sensitivity<I extends Inputs>(
  inputs: I,
  fn: (i: I) => number,
  limit = 5,
): { inputKey: string; label?: string; deltaFor10pct: number }[] {
  const base = fn(inputs);
  const out: { inputKey: string; label?: string; deltaFor10pct: number }[] = [];
  for (const k of Object.keys(inputs)) {
    const t = inputs[k];
    if (!t || t.value === 0 || t.unit === 'flag') continue;
    const bumped = { ...inputs, [k]: withValue(t, t.value * 1.1) } as I;
    const v = fn(bumped);
    if (!Number.isFinite(v) || !Number.isFinite(base)) continue;
    const delta = v - base;
    if (Math.abs(delta) > 1e-12) out.push({ inputKey: k, label: t.label, deltaFor10pct: delta });
  }
  return out.sort((a, b) => Math.abs(b.deltaFor10pct) - Math.abs(a.deltaFor10pct)).slice(0, limit);
}

/** Sum of traced parts. */
export function sum(key: string, unit: string, parts: Traced[], opts: CalcOpts = {}): Traced {
  const formula = parts.map((p) => p.label ?? p.key).join(' + ');
  return calc(key, parts.reduce((s, p) => s + p.value, 0), unit, formula, parts, opts);
}
