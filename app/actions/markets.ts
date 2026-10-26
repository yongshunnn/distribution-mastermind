'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import type { ChannelType, Market } from '@/lib/db/types';
import { TAGS } from '@/lib/validation/schemas';
import type { Tag } from '@/lib/calc/traced';
import { list, n, required, s } from './util';

const done = () => revalidatePath('/', 'layout');

export async function createMarket(form: FormData) {
  const store = await getStore();
  const [m] = await store.insert('markets', [{
    name: required(form, 'name', 'Name'),
    iso2: required(form, 'iso2', 'ISO code').toUpperCase().slice(0, 2),
    currency: required(form, 'currency', 'Currency').toUpperCase().slice(0, 3),
    vat_name: s(form, 'vat_name'),
    status: (s(form, 'status') ?? 'exploring') as Market['status'],
    alt_routes: [],
    lat: n(form, 'lat'),
    lng: n(form, 'lng'),
    blocker: null,
  }]);
  done();
  redirect(`/markets/${m.id}`);
}

export async function updateMarket(form: FormData) {
  const store = await getStore();
  const id = required(form, 'id');
  await store.update('markets', id, {
    status: (s(form, 'status') ?? 'exploring') as Market['status'],
    blocker: s(form, 'blocker'),
    alt_routes: list(form, 'alt_routes'),
  });
  done();
}

/** Adds (or replaces) any tracked value from a form. */
export async function addValue(form: FormData) {
  const store = await getStore();
  const tag = (s(form, 'tag') ?? 'estimated') as Tag;
  if (!TAGS.includes(tag)) throw new Error('Bad tag');
  const given = s(form, 'label');
  const field = s(form, 'field') ?? given?.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!field) throw new Error('Label is required');
  const label = given ?? field.replace(/^score_/, 'Score — ').replace(/_/g, ' ');
  await store.setTrackedValue({
    entity_type: required(form, 'entity_type'),
    entity_id: required(form, 'entity_id'),
    field,
    label,
    value_num: n(form, 'value_num'),
    value_text: s(form, 'value_text'),
    unit: s(form, 'unit'),
    tag,
    source_label: s(form, 'source_label'),
    source_url: s(form, 'source_url'),
    as_of: s(form, 'as_of'),
    note: s(form, 'note'),
  });
  done();
}

export async function addSegment(form: FormData) {
  const store = await getStore();
  const [seg] = await store.insert('segments', [{ market_id: required(form, 'market_id'), outlet_type: required(form, 'outlet_type', 'Outlet type'), area_id: s(form, 'area_id') }]);
  const count = n(form, 'outlet_count');
  if (count !== null)
    await store.setTrackedValue({ entity_type: 'segment', entity_id: seg.id, field: 'outlet_count', label: `${seg.outlet_type} outlets`, value_num: count, unit: 'outlets', tag: (s(form, 'tag') ?? 'estimated') as Tag, source_label: s(form, 'source_label') });
  done();
}

export async function addChannel(form: FormData) {
  const store = await getStore();
  const [ch] = await store.insert('channels', [{
    market_id: required(form, 'market_id'),
    name: required(form, 'name', 'Name'),
    channel_type: required(form, 'channel_type') as ChannelType,
    segment_ids: form.getAll('segment_ids').map(String),
    has_distributor_tier: form.get('has_distributor_tier') === 'on',
    notes: s(form, 'notes'),
  }]);
  const [terms] = await store.insert('channel_terms', [{ channel_id: ch.id, principal_id: null, delivery_mode: s(form, 'delivery_mode') }]);
  for (const [field, label, unit] of [['retailer_margin', 'Channel margin', 'pct'], ['receivable_days', 'Payment terms', 'days'], ['listing_fee_total', 'Listing fees', null]] as const) {
    const v = n(form, field);
    await store.setTrackedValue({ entity_type: 'channel_terms', entity_id: terms.id, field, label, value_num: v, unit: unit ?? null, tag: v === null ? 'placeholder' : 'quoted', source_label: s(form, 'source_label') });
  }
  done();
}

export async function addTradeRule(form: FormData) {
  const store = await getStore();
  const [r] = await store.insert('trade_rules', [{
    hs_code: required(form, 'hs_code', 'HS code'),
    origin_iso2: s(form, 'origin_iso2')?.toUpperCase() ?? null,
    dest_iso2: required(form, 'dest_iso2').toUpperCase(),
    regime: required(form, 'regime', 'Regime').toUpperCase(),
    coo_form: s(form, 'coo_form'),
    source: s(form, 'source'),
  }]);
  await store.setTrackedValue({ entity_type: 'trade_rule', entity_id: r.id, field: 'duty_pct', label: `Duty ${r.regime} HS ${r.hs_code}`, value_num: n(form, 'duty_pct') ?? 0, unit: 'pct', tag: (s(form, 'tag') ?? 'estimated') as Tag, source_label: s(form, 'source'), source_url: s(form, 'source_url') });
  done();
}

export async function addGate(form: FormData) {
  const store = await getStore();
  await store.insert('compliance_gates', [{
    market_id: required(form, 'market_id'),
    product_family_id: s(form, 'product_family_id'),
    requirement: required(form, 'requirement', 'Requirement'),
    detail: s(form, 'detail'),
    authority: s(form, 'authority'),
    deadline: s(form, 'deadline'),
    status: 'open',
    tag: (s(form, 'tag') ?? 'estimated') as Tag,
    source: s(form, 'source'),
    source_url: s(form, 'source_url'),
  }]);
  done();
}

export async function updateGateStatus(form: FormData) {
  const store = await getStore();
  await store.update('compliance_gates', required(form, 'id'), { status: required(form, 'status') });
  done();
}

export async function addEvidence(form: FormData) {
  const store = await getStore();
  await store.insert('market_evidence', [{
    market_id: required(form, 'market_id'), statement: required(form, 'statement', 'Statement'), value: s(form, 'value'),
    tag: (s(form, 'tag') ?? 'public') as Tag, source: s(form, 'source'), source_url: s(form, 'source_url'), as_of: s(form, 'as_of'),
  }]);
  done();
}

export async function addArea(form: FormData) {
  const store = await getStore();
  const [a] = await store.insert('market_areas', [{ market_id: required(form, 'market_id'), name: required(form, 'name', 'Name') }]);
  for (const f of ['population', 'households'] as const) {
    const v = n(form, f);
    if (v !== null) await store.setTrackedValue({ entity_type: 'market_area', entity_id: a.id, field: f, label: `${a.name} ${f}`, value_num: v, unit: f === 'population' ? 'people' : 'households', tag: (s(form, 'tag') ?? 'public') as Tag, source_label: s(form, 'source_label') });
  }
  done();
}
