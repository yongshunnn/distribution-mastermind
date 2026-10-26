import 'server-only';
import { cache } from 'react';
import { leaf, type HistoryEntry, type Tag, type Traced } from '@/lib/calc/traced';
import type { FxRate } from '@/lib/calc/fx';
import { WORKSPACE_ID } from '@/lib/seed/ids';
import { getStore } from './store';
import type { Row, TableName, TrackedValue } from './types';

/** All rows of a table, loaded at most once per request. */
export const rows = cache(async <T extends TableName>(table: T): Promise<Row<T>[]> => {
  const s = await getStore();
  return s.list(table);
});

export async function byId<T extends TableName>(table: T, id: string): Promise<Row<T> | undefined> {
  return (await rows(table)).find((r) => (r as { id?: string }).id === id);
}

const vkey = (t: string, id: string, f: string) => `${t}|${id}|${f}`;

export interface ValueIndex {
  current: Map<string, TrackedValue>;
  history: Map<string, TrackedValue[]>;
  forEntity(type: string, id: string): TrackedValue[];
  get(type: string, id: string, field: string): TrackedValue | undefined;
}

export const valueIndex = cache(async (): Promise<ValueIndex> => {
  const all = await rows('tracked_values');
  const current = new Map<string, TrackedValue>();
  const history = new Map<string, TrackedValue[]>();
  for (const v of all) {
    const k = vkey(v.entity_type, v.entity_id, v.field);
    if (v.is_current) current.set(k, v);
    const h = history.get(k) ?? [];
    h.push(v);
    history.set(k, h);
  }
  for (const h of history.values()) h.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  return {
    current,
    history,
    forEntity: (type, id) => all.filter((v) => v.is_current && v.entity_type === type && v.entity_id === id),
    get: (type, id, field) => current.get(vkey(type, id, field)),
  };
});

export function historyOf(idx: ValueIndex, v: TrackedValue): HistoryEntry[] {
  return (idx.history.get(vkey(v.entity_type, v.entity_id, v.field)) ?? []).map((h) => ({
    value: h.value_num,
    text: h.value_text,
    tag: h.tag,
    source: h.source_label,
    at: h.created_at,
  }));
}

export const CURRENCY_RE = /^([A-Z]{3})(\/.*)?$/;

/** Percent stored as 8 (unit 'pct') becomes 0.08 with unit '%'. */
export function tracedFromValue(v: TrackedValue, idx?: ValueIndex, key = v.field, meaning?: string): Traced {
  const isPct = v.unit === 'pct';
  const value = v.value_num == null ? 0 : isPct ? Number(v.value_num) / 100 : Number(v.value_num);
  const t = leaf(key, value, isPct ? '%' : (v.unit ?? ''), {
    tag: v.tag,
    label: v.label ?? undefined,
    meaning,
    source: v.source_label ? { label: v.source_label, url: v.source_url ?? undefined, asOf: v.as_of ?? undefined } : v.as_of ? { label: 'No source recorded', asOf: v.as_of } : undefined,
    ref: { entityType: v.entity_type, entityId: v.entity_id, field: v.field, unit: v.unit, raw: v.value_num == null ? null : Number(v.value_num), text: v.value_text },
    note: [v.value_num == null && v.value_text == null ? 'Empty — no figure yet.' : null, v.note].filter(Boolean).join(' ') || undefined,
    history: idx ? historyOf(idx, v) : undefined,
  });
  return t;
}

export const settings = cache(async () => {
  const s = await rows('settings');
  const get = <X,>(k: string, d: X): X => (s.find((x) => x.key === k)?.value as X) ?? d;
  return {
    staleDays: get('stale_threshold_days', 180),
    clusterWidthPct: get('cluster_width_pct', 12.5),
    baseCurrency: get('base_currency', 'SGD'),
  };
});

export async function workspaceValue(field: string): Promise<TrackedValue | undefined> {
  return (await valueIndex()).get('workspace', WORKSPACE_ID, field);
}

export const fxRates = cache(async (): Promise<FxRate[]> => {
  const r = await rows('fx_rates');
  return r.map((x) => ({ base: x.base, quote: x.quote, rate: Number(x.rate), month: x.month, tag: x.tag as Tag, source: x.source }));
});

export const glossaryMap = cache(async () => {
  const g = await rows('glossary');
  return Object.fromEntries(g.map((x) => [x.key, { label: x.label, meaning: x.meaning, formula: x.formula_text ?? undefined }]));
});

export { WORKSPACE_ID };
