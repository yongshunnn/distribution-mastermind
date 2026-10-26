'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { snapshot } from '@/lib/db/principals';
import { draftSupplyChain } from '@/lib/supply-chain/draft';
import type { Tag } from '@/lib/calc/traced';
import type { Principal, SalesRecord } from '@/lib/db/types';
import { list, n, required, s } from './util';

const done = () => revalidatePath('/', 'layout');

export async function createPrincipal(form: FormData) {
  const store = await getStore();
  const name = required(form, 'name', 'Company');
  const [p] = await store.insert('principals', [{ name, country: s(form, 'country')?.toUpperCase() ?? null, contact: s(form, 'contact'), contract_type: null, territories: [], exclusivity: null, status: 'active', notes: null }]);
  await store.insert('brands', [{ principal_id: p.id, name: s(form, 'brand') ?? name, origin_claim: null, story: null }]);
  await snapshot(p.id, 1);
  done();
  redirect(`/principals/${p.id}/setup?step=1`);
}

export async function saveStep1(form: FormData) {
  const store = await getStore();
  const id = required(form, 'id');
  await store.update('principals', id, {
    name: required(form, 'name', 'Company'),
    country: s(form, 'country')?.toUpperCase() ?? null,
    contact: s(form, 'contact'),
    contract_type: (s(form, 'contract_type') as Principal['contract_type']) ?? null,
    territories: list(form, 'territories').map((t) => t.toUpperCase()),
    exclusivity: s(form, 'exclusivity'),
    notes: s(form, 'notes'),
  });
  const brandId = s(form, 'brand_id');
  const brandFields = { name: s(form, 'brand_name') ?? 'Brand', origin_claim: s(form, 'origin_claim'), story: s(form, 'story') };
  if (brandId) await store.update('brands', brandId, brandFields);
  else await store.insert('brands', [{ principal_id: id, ...brandFields }]);
  await snapshot(id, 1);
  done();
}

export async function addFeeTerm(form: FormData) {
  const store = await getStore();
  const principalId = required(form, 'principal_id');
  const model = required(form, 'model') as 'retainer' | 'commission' | 'profit_share';
  const [fee] = await store.insert('principal_fee_terms', [{
    principal_id: principalId, model, basis: model === 'retainer' ? 'monthly' : model === 'commission' ? 'net_sales' : 'market_npat_after_payback',
    currency: s(form, 'currency') ?? 'SGD', start_date: s(form, 'start_date'), end_date: s(form, 'end_date'),
  }]);
  await store.setTrackedValue({
    entity_type: 'principal_fee_terms', entity_id: fee.id, field: 'amount_or_pct', label: model === 'retainer' ? 'Monthly retainer' : model === 'commission' ? 'Commission on net sales' : 'Share of market NPAT after payback',
    value_num: n(form, 'amount'), unit: model === 'retainer' ? `${s(form, 'currency') ?? 'SGD'}/month` : 'pct', tag: (s(form, 'tag') ?? 'quoted') as Tag, source_label: s(form, 'source_label'),
  });
  await snapshot(principalId, 1);
  done();
}

export async function removeFeeTerm(form: FormData) {
  const store = await getStore();
  await store.remove('principal_fee_terms', required(form, 'id'));
  done();
}

export async function saveSite(form: FormData) {
  const store = await getStore();
  const principalId = required(form, 'principal_id');
  const row = {
    principal_id: principalId, name: required(form, 'name', 'Site name'), country: s(form, 'country')?.toUpperCase() ?? null, lat: n(form, 'lat'), lng: n(form, 'lng'),
    capacity: s(form, 'capacity'), moq: s(form, 'moq'), lead_time_days: n(form, 'lead_time_days'), incoterm: s(form, 'incoterm'), currency: s(form, 'currency')?.toUpperCase() ?? null,
  };
  const id = s(form, 'id');
  if (id) await store.update('production_sites', id, row);
  else await store.insert('production_sites', [row]);
  await snapshot(principalId, 2);
  done();
}

/** EXW / FOB price per SKU (step 2). */
export async function saveSupplierPrice(form: FormData) {
  const store = await getStore();
  const skuId = required(form, 'sku_config_id');
  const currency = (s(form, 'currency') ?? 'SGD').toUpperCase();
  const priceType = (s(form, 'price_type') ?? 'supplier_exw') as 'supplier_exw' | 'fob';
  const existing = (await store.list('sku_prices', { sku_config_id: skuId })).find((p) => p.price_type === priceType && !p.market_id);
  const price = existing ?? (await store.insert('sku_prices', [{ sku_config_id: skuId, market_id: null, channel_id: null, price_type: priceType, currency }]))[0];
  const sku = await store.get('sku_configs', skuId);
  await store.setTrackedValue({ entity_type: 'sku_price', entity_id: price.id, field: 'price', label: `${sku?.sku_code} ${priceType === 'fob' ? 'FOB' : 'supplier EXW'}`, value_num: n(form, 'price'), unit: `${currency}/unit`, tag: (s(form, 'tag') ?? 'quoted') as Tag, source_label: s(form, 'source_label') });
  await snapshot(required(form, 'principal_id'), 2);
  done();
}

/** Step 4: principal-specific channel terms and shelf price, then re-draft the supply-chain map. */
export async function saveDistribution(form: FormData) {
  const store = await getStore();
  const principalId = required(form, 'principal_id');
  const channelId = required(form, 'channel_id', 'Channel');
  const channel = await store.get('channels', channelId);
  if (!channel) throw new Error('Channel not found');
  const market = await store.get('markets', channel.market_id);
  let terms = (await store.list('channel_terms', { channel_id: channelId })).find((t) => t.principal_id === principalId);
  if (!terms) terms = (await store.insert('channel_terms', [{ channel_id: channelId, principal_id: principalId, delivery_mode: s(form, 'delivery_mode') }]))[0];
  const tag = (s(form, 'tag') ?? 'quoted') as Tag;
  const src = s(form, 'source_label');
  for (const [field, label, unit] of [['retailer_margin', 'Channel margin', 'pct'], ['rebate', 'Rebate', 'pct'], ['receivable_days', 'Payment terms', 'days'], ['listing_fee_total', 'Listing fees', market?.currency ?? 'SGD'], ['returns_pct', 'Returns', 'pct']] as const) {
    const v = n(form, field);
    if (v !== null) await store.setTrackedValue({ entity_type: 'channel_terms', entity_id: terms.id, field, label, value_num: v, unit, tag, source_label: src });
  }
  const skuId = s(form, 'sku_config_id');
  const shelf = n(form, 'shelf_price');
  if (skuId && shelf !== null && market) {
    const existing = (await store.list('sku_prices', { sku_config_id: skuId })).find((p) => p.price_type === 'shelf' && p.channel_id === channelId);
    const price = existing ?? (await store.insert('sku_prices', [{ sku_config_id: skuId, market_id: market.id, channel_id: channelId, price_type: 'shelf', currency: market.currency }]))[0];
    await store.setTrackedValue({ entity_type: 'sku_price', entity_id: price.id, field: 'price', label: `Shelf price at ${channel.name}`, value_num: shelf, unit: `${market.currency}/unit`, tag, source_label: src });
  }
  await redraft(principalId);
  await snapshot(principalId, 4);
  done();
}

/** Rebuild sc_nodes / sc_lanes for a principal from its sites and the channels it sells through. */
export async function redraft(principalId: string) {
  const store = await getStore();
  const [sites, terms, plays, channels, markets, brands, families, skus] = await Promise.all([
    store.list('production_sites', { principal_id: principalId }), store.list('channel_terms', { principal_id: principalId }), store.list('plays'),
    store.list('channels'), store.list('markets'), store.list('brands', { principal_id: principalId }), store.list('product_families'), store.list('sku_configs'),
  ]);
  const skuIds = new Set(skus.filter((s) => families.some((f) => f.id === s.family_id && brands.some((b) => b.id === f.brand_id))).map((s) => s.id));
  const channelIds = new Set([...terms.map((t) => t.channel_id), ...plays.filter((p) => skuIds.has(p.sku_config_id)).map((p) => p.channel_id)]);
  const draft = draftSupplyChain(principalId, sites, channels.filter((c) => channelIds.has(c.id)), markets);
  for (const n of await store.list('sc_nodes', { principal_id: principalId })) await store.remove('sc_nodes', n.id);
  const created = await store.insert('sc_nodes', draft.nodes.map(({ key: _key, ...rest }) => rest));
  const idByKey = new Map(draft.nodes.map((d, i) => [d.key, created[i].id]));
  if (draft.lanes.length)
    await store.insert('sc_lanes', draft.lanes.map(({ from, to, ...rest }) => ({ ...rest, from_node: idByKey.get(from)!, to_node: idByKey.get(to)! })));
}

export async function redraftAction(form: FormData) {
  await redraft(required(form, 'principal_id'));
  done();
}

/** Step 6: cost quotes stored as market-level tracked values (they feed every play in that market). */
export async function saveCost(form: FormData) {
  const store = await getStore();
  const marketId = required(form, 'market_id', 'Market');
  const field = required(form, 'field', 'Cost');
  const market = await store.get('markets', marketId);
  const units: Record<string, string> = {
    freight_per_unit: `${market?.currency}/unit`, origin_handling_per_unit: `${market?.currency}/unit`, clearance_per_unit: `${market?.currency}/unit`, insurance_per_unit: `${market?.currency}/unit`,
    pallet_cost_per_day: `${market?.currency}/pallet/day`, handling_per_order: `${market?.currency}/order`, delivery_cost_per_drop: `${market?.currency}/drop`,
    marketing_per_unit: `${market?.currency}/unit`, fixed_monthly_cost: `${market?.currency}/month`, stock_days: 'days',
  };
  await store.setTrackedValue({ entity_type: 'market', entity_id: marketId, field, value_num: n(form, 'value_num'), unit: s(form, 'unit') ?? units[field] ?? null, tag: (s(form, 'tag') ?? 'quoted') as Tag, source_label: s(form, 'source_label'), as_of: s(form, 'as_of'), note: s(form, 'note') });
  await snapshot(required(form, 'principal_id'), 6);
  done();
}

export interface SalesRowInput { sku_code: string; market: string; channel?: string; month: string; units?: number; value?: number; currency?: string; source?: string }

/** Step 5: monthly sales by SKU × channel × country (template upload or single row). */
export async function importSales(principalId: string, input: SalesRowInput[]): Promise<{ ok: number; errors: string[] }> {
  const store = await getStore();
  const [skus, markets, channels] = await Promise.all([store.list('sku_configs'), store.list('markets'), store.list('channels')]);
  const errors: string[] = [];
  const out: Omit<SalesRecord, 'id' | 'created_at' | 'updated_at' | 'created_by'>[] = [];
  input.forEach((r, i) => {
    const sku = skus.find((s) => s.sku_code === String(r.sku_code ?? '').trim());
    const market = markets.find((m) => m.iso2 === String(r.market ?? '').trim().toUpperCase() || m.name.toLowerCase() === String(r.market ?? '').trim().toLowerCase());
    const channel = channels.find((c) => c.market_id === market?.id && c.name.toLowerCase() === String(r.channel ?? '').trim().toLowerCase());
    const month = String(r.month ?? '').trim();
    if (!sku) return errors.push(`Row ${i + 2}: unknown sku_code "${r.sku_code}"`);
    if (!market) return errors.push(`Row ${i + 2}: unknown market "${r.market}"`);
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(month)) return errors.push(`Row ${i + 2}: month must be YYYY-MM`);
    out.push({
      sku_config_id: sku.id, market_id: market.id, channel_id: channel?.id ?? null, month: month.length === 7 ? `${month}-01` : month,
      units: r.units == null || String(r.units) === '' ? null : Number(r.units), value: r.value == null || String(r.value) === '' ? null : Number(r.value),
      currency: (r.currency ?? market.currency).toUpperCase(), source: (r.source === 'actual' ? 'actual' : 'principal_reported') as 'actual' | 'principal_reported',
    });
  });
  if (out.length) await store.insert('sales_records', out);
  await snapshot(principalId, 5);
  done();
  return { ok: out.length, errors };
}
