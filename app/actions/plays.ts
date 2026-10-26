'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import type { RouteType } from '@/lib/db/types';
import type { Tag } from '@/lib/calc/traced';
import { PLAY_INPUT_KEYS, type PlayInputKey } from '@/lib/calc/play';
import { list, n, required, s } from './util';

export async function createPlay(form: FormData) {
  const store = await getStore();
  const channelId = required(form, 'channel_id', 'Channel');
  const channel = await store.get('channels', channelId);
  if (!channel) throw new Error('Channel not found');
  const market = await store.get('markets', channel.market_id);
  const skuId = required(form, 'sku_config_id', 'SKU');
  const sku = await store.get('sku_configs', skuId);
  const [play] = await store.insert('plays', [{
    name: s(form, 'name') ?? `${channel.name} · ${sku?.name ?? sku?.sku_code}`,
    sku_config_id: skuId, channel_id: channelId, segment_id: s(form, 'segment_id'), market_id: channel.market_id,
    route_type: (s(form, 'route_type') ?? 'retail_chain') as RouteType, status: 'draft',
    assumption_overrides: { coo_forms: list(form, 'coo_forms') },
  }]);
  const tag = (s(form, 'tag') ?? 'estimated') as Tag;
  const q = n(form, 'q_realistic_month');
  const e = n(form, 'entry_cost');
  await store.setTrackedValue({ entity_type: 'play', entity_id: play.id, field: 'q_realistic_month', label: 'Realistic volume', value_num: q, unit: 'units/month', tag: q == null ? 'placeholder' : tag });
  await store.setTrackedValue({ entity_type: 'play', entity_id: play.id, field: 'entry_cost', label: 'Entry cost', value_num: e, unit: market?.currency ?? 'SGD', tag: e == null ? 'placeholder' : tag });
  const shelf = n(form, 'shelf_price');
  if (shelf != null && market) {
    const [price] = await store.insert('sku_prices', [{ sku_config_id: skuId, market_id: market.id, channel_id: channelId, price_type: 'shelf', currency: market.currency }]);
    await store.setTrackedValue({ entity_type: 'sku_price', entity_id: price.id, field: 'price', label: `${sku?.sku_code} shelf price at ${channel.name}`, value_num: shelf, unit: `${market.currency}/unit`, tag });
  }
  revalidatePath('/', 'layout');
  redirect(`/plays/${play.id}`);
}

/** Override one input for this play only (stored as a tracked value on the play). */
export async function setPlayInput(form: FormData) {
  const store = await getStore();
  const playId = required(form, 'play_id');
  const key = required(form, 'key') as PlayInputKey;
  if (!PLAY_INPUT_KEYS.includes(key)) throw new Error('Unknown input');
  await store.setTrackedValue({
    entity_type: 'play', entity_id: playId, field: key, label: s(form, 'label'), value_num: n(form, 'value_num'), unit: s(form, 'unit'),
    tag: (s(form, 'tag') ?? 'estimated') as Tag, source_label: s(form, 'source_label'), note: s(form, 'note'), as_of: s(form, 'as_of'),
  });
  revalidatePath('/', 'layout');
}

/** Saves slider positions as play-level overrides. */
export async function saveWhatIf(playId: string, values: Record<string, { value: number; unit: string; label?: string }>) {
  const store = await getStore();
  for (const [key, v] of Object.entries(values)) {
    if (!PLAY_INPUT_KEYS.includes(key as PlayInputKey)) continue;
    const isPct = v.unit === '%';
    await store.setTrackedValue({
      entity_type: 'play', entity_id: playId, field: key, label: v.label ?? null, value_num: isPct ? Math.round(v.value * 10000) / 100 : v.value,
      unit: isPct ? 'pct' : v.unit, tag: 'estimated', source_label: 'What-if sliders', note: 'Saved from the play sensitivity sliders.',
    });
  }
  revalidatePath('/', 'layout');
}

export async function updatePlay(form: FormData) {
  const store = await getStore();
  const id = required(form, 'id');
  const play = await store.get('plays', id);
  if (!play) throw new Error('Play not found');
  await store.update('plays', id, {
    name: s(form, 'name') ?? play.name,
    status: s(form, 'status') ?? play.status,
    route_type: (s(form, 'route_type') ?? play.route_type) as RouteType,
    assumption_overrides: { ...play.assumption_overrides, coo_forms: list(form, 'coo_forms'), origin_iso2: s(form, 'origin_iso2') ?? undefined },
  });
  revalidatePath('/', 'layout');
}
