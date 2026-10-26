import 'server-only';
import { randomUUID } from 'node:crypto';
import { connection } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured } from '@/lib/env';
import { buildSeed } from '@/lib/seed/build';
import { supabaseServer } from '@/lib/supabase/server';
import type { Tag } from '@/lib/calc/traced';
import { KEY_COLUMN, type Dataset, type Row, type TableName, type TrackedValue } from './types';

export interface SetValueInput {
  entity_type: string;
  entity_id: string;
  field: string;
  value_num: number | null;
  value_text?: string | null;
  unit?: string | null;
  tag: Tag;
  source_label?: string | null;
  source_url?: string | null;
  as_of?: string | null;
  note?: string | null;
  label?: string | null;
}

export interface Store {
  mode: 'memory' | 'supabase';
  list<T extends TableName>(table: T, where?: Partial<Row<T>>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  setTrackedValue(v: SetValueInput): Promise<TrackedValue>;
  userEmail(): Promise<string | null>;
}

// ───────────────────────── memory (demo mode) ─────────────────────────
type MemState = { data: Dataset };
const g = globalThis as unknown as { __dmStore?: MemState };

function mem(): MemState {
  if (!g.__dmStore) g.__dmStore = { data: buildSeed() };
  return g.__dmStore;
}

/** Test hook: restore the seed. */
export function resetMemoryStore() {
  g.__dmStore = { data: buildSeed() };
}

const clone = <X,>(x: X): X => structuredClone(x);

function matches(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

const memoryStore: Store = {
  mode: 'memory',
  async list(table, where) {
    const rows = mem().data[table] as unknown as Record<string, unknown>[];
    return clone(rows.filter((r) => matches(r, where as Record<string, unknown>))) as never;
  },
  async get(table, id) {
    const key = KEY_COLUMN[table] ?? 'id';
    const rows = mem().data[table] as unknown as Record<string, unknown>[];
    const r = rows.find((x) => x[key] === id);
    return (r ? clone(r) : null) as never;
  },
  async insert(table, rows) {
    const now = new Date().toISOString();
    const target = mem().data[table] as unknown as Record<string, unknown>[];
    const key = KEY_COLUMN[table];
    const created = rows.map((r) => {
      const row: Record<string, unknown> = key
        ? { created_at: now, ...r }
        : { id: randomUUID(), created_at: now, updated_at: now, created_by: null, ...r };
      target.push(row);
      return clone(row);
    });
    return created as never;
  },
  async update(table, id, patch) {
    const key = KEY_COLUMN[table] ?? 'id';
    const rows = mem().data[table] as unknown as Record<string, unknown>[];
    const r = rows.find((x) => x[key] === id);
    if (!r) throw new Error(`${table} ${id} not found`);
    Object.assign(r, patch, key === 'id' ? { updated_at: new Date().toISOString() } : {});
    return clone(r) as never;
  },
  async remove(table, id) {
    const key = KEY_COLUMN[table] ?? 'id';
    const rows = mem().data[table] as unknown as Record<string, unknown>[];
    const i = rows.findIndex((x) => x[key] === id);
    if (i >= 0) rows.splice(i, 1);
  },
  async setTrackedValue(v) {
    const rows = mem().data.tracked_values;
    const old = rows.find((r) => r.is_current && r.entity_type === v.entity_type && r.entity_id === v.entity_id && r.field === v.field);
    const now = new Date().toISOString();
    const row: TrackedValue = {
      id: randomUUID(), created_at: now, updated_at: now, created_by: null,
      entity_type: v.entity_type, entity_id: v.entity_id, field: v.field,
      label: v.label ?? old?.label ?? null, value_num: v.value_num, value_text: v.value_text ?? null,
      unit: v.unit ?? old?.unit ?? null, tag: v.tag, source_label: v.source_label ?? null, source_url: v.source_url ?? null,
      as_of: v.as_of ?? null, note: v.note ?? null, is_current: true, replaced_by: null,
    };
    if (old) {
      old.is_current = false;
      old.replaced_by = row.id;
    }
    rows.push(row);
    return clone(row);
  },
  async userEmail() {
    return null;
  },
};

// ───────────────────────── supabase ─────────────────────────
function supabaseStore(sb: SupabaseClient): Store {
  const fail = (table: string, e: { message: string } | null) => {
    if (e) throw new Error(`${table}: ${e.message}`);
  };
  return {
    mode: 'supabase',
    async list(table, where) {
      const all: Row<typeof table>[] = [];
      // Page through results; PostgREST caps responses at 1000 rows by default.
      for (let from = 0; ; from += 1000) {
        let q = sb.from(table).select('*').range(from, from + 999);
        if (where) q = q.match(where as Record<string, unknown>);
        const { data, error } = await q;
        fail(table, error);
        all.push(...((data ?? []) as Row<typeof table>[]));
        if (!data || data.length < 1000) break;
      }
      return all as never;
    },
    async get(table, id) {
      const { data, error } = await sb.from(table).select('*').eq((KEY_COLUMN[table] ?? 'id') as string, id).maybeSingle();
      fail(table, error);
      return data as never;
    },
    async insert(table, rows) {
      const { data, error } = await sb.from(table).insert(rows as never).select('*');
      fail(table, error);
      return (data ?? []) as never;
    },
    async update(table, id, patch) {
      const { data, error } = await sb.from(table).update(patch as never).eq((KEY_COLUMN[table] ?? 'id') as string, id).select('*').single();
      fail(table, error);
      return data as never;
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq((KEY_COLUMN[table] ?? 'id') as string, id);
      fail(table, error);
    },
    async setTrackedValue(v) {
      const { data, error } = await sb.rpc('set_tracked_value', {
        p_entity_type: v.entity_type, p_entity_id: v.entity_id, p_field: v.field, p_value_num: v.value_num,
        p_value_text: v.value_text ?? null, p_unit: v.unit ?? null, p_tag: v.tag, p_source_label: v.source_label ?? null,
        p_source_url: v.source_url ?? null, p_as_of: v.as_of ?? null, p_note: v.note ?? null, p_label: v.label ?? null,
      });
      fail('set_tracked_value', error);
      return data as TrackedValue;
    },
    async userEmail() {
      const { data } = await sb.auth.getUser();
      return data.user?.email ?? null;
    },
  };
}

/** The store for this request. Calling it opts the route into dynamic rendering. */
export async function getStore(): Promise<Store> {
  await connection();
  if (!isSupabaseConfigured()) return memoryStore;
  return supabaseStore(await supabaseServer());
}
