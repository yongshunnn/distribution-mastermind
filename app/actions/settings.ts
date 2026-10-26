'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import { isSupabaseConfigured } from '@/lib/env';
import { supabaseService } from '@/lib/supabase/server';
import type { Tag } from '@/lib/calc/traced';
import { n, required, s } from './util';

const done = () => revalidatePath('/', 'layout');

export async function saveSettings(form: FormData) {
  const store = await getStore();
  const existing = await store.list('settings');
  for (const key of ['stale_threshold_days', 'cluster_width_pct']) {
    const v = n(form, key);
    if (v === null) continue;
    if (existing.some((x) => x.key === key)) await store.update('settings', key, { value: v, updated_at: new Date().toISOString() });
    else await store.insert('settings', [{ key, value: v, updated_at: new Date().toISOString() }]);
  }
  done();
}

export async function saveGlossary(form: FormData) {
  const store = await getStore();
  const id = s(form, 'id');
  const row = { key: required(form, 'key', 'Key'), label: required(form, 'label', 'Label'), meaning: required(form, 'meaning', 'Meaning'), formula_text: s(form, 'formula_text'), unit: s(form, 'unit') };
  if (id) await store.update('glossary', id, row);
  else await store.insert('glossary', [row]);
  done();
}

export async function saveBenchmark(form: FormData) {
  const store = await getStore();
  const id = s(form, 'id');
  const row = {
    market_id: s(form, 'market_id'), role: required(form, 'role', 'Role'), metric: required(form, 'metric', 'Metric'), low: n(form, 'low'), high: n(form, 'high'),
    text_value: s(form, 'text_value'), unit: s(form, 'unit'), tag: (s(form, 'tag') ?? 'estimated') as Tag, source: s(form, 'source'), source_url: s(form, 'source_url'),
  };
  if (id) await store.update('terms_benchmarks', id, row);
  else await store.insert('terms_benchmarks', [row]);
  done();
}

export async function saveTemplateItem(form: FormData) {
  const store = await getStore();
  const id = s(form, 'id');
  const row = { stage_no: n(form, 'stage_no') ?? 1, item: required(form, 'item', 'Item'), required: form.get('required') === 'on', watch_out: s(form, 'watch_out'), sort: n(form, 'sort') ?? 999 };
  if (id) await store.update('stage_items_template', id, row);
  else await store.insert('stage_items_template', [row]);
  done();
}

export async function addFxRate(form: FormData) {
  const store = await getStore();
  const month = required(form, 'month', 'Month');
  await store.insert('fx_rates', [{
    base: required(form, 'base').toUpperCase(), quote: required(form, 'quote').toUpperCase(), rate: n(form, 'rate') ?? 0,
    month: month.length === 7 ? `${month}-01` : month, tag: (s(form, 'tag') ?? 'public') as Tag, source: s(form, 'source'),
  }]);
  done();
}

/** Allowlist changes need the service role (members can only read allowed_users). */
export async function addAllowedUser(form: FormData) {
  const email = required(form, 'email', 'Email').toLowerCase();
  const row = { email, display_name: s(form, 'display_name'), role: 'member', created_at: new Date().toISOString() };
  const store = await getStore();
  if (!isSupabaseConfigured() || store.mode !== 'supabase') {
    await store.insert('allowed_users', [row]);
  } else {
    const svc = supabaseService();
    if (!svc) throw new Error('Set SUPABASE_SERVICE_ROLE_KEY on the server to manage the allowlist from the app, or insert into allowed_users in the Supabase SQL editor.');
    const { error } = await svc.from('allowed_users').upsert(row);
    if (error) throw new Error(error.message);
  }
  done();
}
