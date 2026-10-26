import 'server-only';
import { getStore } from '@/lib/db/store';
import { skuImportRowSchema, type SkuImportRow } from '@/lib/validation/schemas';
import { normaliseSkuRow } from './columns';

export type DiffKind = 'new' | 'changed' | 'conflict' | 'unchanged' | 'invalid';

export interface DiffRow {
  line: number;
  sku_code: string;
  kind: DiffKind;
  changes: { field: string; from: string; to: string }[];
  problems: string[];
  row?: SkuImportRow;
}

const sizeMl = (r: SkuImportRow) => {
  if (r.size === undefined) return undefined;
  const u = (r.size_unit ?? 'ml').toLowerCase();
  return u === 'l' ? r.size * 1000 : u === 'ml' ? r.size : undefined;
};

/** Compares an upload with the catalogue: new / changed / conflicting rows, before anything is written. */
export async function diffSkuImport(rawRows: Record<string, unknown>[]): Promise<DiffRow[]> {
  const store = await getStore();
  const [skus, families, brands, packs, markets] = await Promise.all([
    store.list('sku_configs'), store.list('product_families'), store.list('brands'), store.list('pack_levels'), store.list('markets'),
  ]);
  const seen = new Map<string, number>();
  const out: DiffRow[] = [];
  rawRows.forEach((raw, i) => {
    const line = i + 2;
    const parsed = skuImportRowSchema.safeParse(normaliseSkuRow(raw));
    if (!parsed.success) {
      out.push({ line, sku_code: String(raw.sku_code ?? '?'), kind: 'invalid', changes: [], problems: parsed.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`) });
      return;
    }
    const r = parsed.data;
    const problems: string[] = [];
    if (seen.has(r.sku_code)) {
      const prev = out[seen.get(r.sku_code)!];
      if (prev.row && (prev.row.family !== r.family || prev.row.units_per_carton !== r.units_per_carton || prev.row.size !== r.size))
        problems.push(`Appears again on line ${prev.line} with different product data`);
    }
    seen.set(r.sku_code, out.length);
    if (r.market && !markets.some((m) => m.iso2 === r.market!.toUpperCase() || m.name.toLowerCase() === r.market!.toLowerCase())) problems.push(`Unknown market "${r.market}"`);
    const existing = skus.find((s) => s.sku_code === r.sku_code);
    if (r.barcode) {
      const clash = skus.find((s) => s.barcode === r.barcode && s.sku_code !== r.sku_code);
      if (clash) problems.push(`Barcode already used by ${clash.sku_code}`);
    }
    const fam = families.find((f) => f.name.toLowerCase() === r.family.toLowerCase());
    if (fam) {
      const famBrand = brands.find((b) => b.id === fam.brand_id);
      if (famBrand && famBrand.name.toLowerCase() !== r.brand.toLowerCase()) problems.push(`Family "${r.family}" belongs to brand ${famBrand.name}, not ${r.brand}`);
    }
    if (!existing) {
      out.push({ line, sku_code: r.sku_code, kind: problems.length ? 'conflict' : 'new', changes: [], problems, row: r });
      return;
    }
    const changes: DiffRow['changes'] = [];
    const cmp = (field: string, from: unknown, to: unknown) => {
      if (to === undefined || to === null || to === '') return;
      if (String(from ?? '') !== String(to)) changes.push({ field, from: from == null ? '—' : String(from), to: String(to) });
    };
    const curFam = families.find((f) => f.id === existing.family_id);
    cmp('family', curFam?.name, r.family);
    cmp('barcode', existing.barcode, r.barcode);
    cmp('shelf_life_days', existing.shelf_life_days, r.shelf_life_days);
    cmp('size_ml', (existing.variant_attrs as Record<string, unknown>).size_ml, sizeMl(r));
    for (const [k, v] of Object.entries(r.variant_attrs)) cmp(`variant_attr:${k}`, (existing.variant_attrs as Record<string, unknown>)[k], v);
    const carton = packs.find((p) => p.sku_config_id === existing.id && p.level === 'carton');
    cmp('units_per_carton', carton?.units_per_level, r.units_per_carton);
    cmp('carton_l_cm', carton?.l_cm, r.carton_l_cm);
    cmp('carton_w_cm', carton?.w_cm, r.carton_w_cm);
    cmp('carton_h_cm', carton?.h_cm, r.carton_h_cm);
    cmp('carton_kg', carton?.gross_kg, r.carton_kg);
    if (r.price !== undefined) changes.push({ field: `${r.price_type} price${r.market ? ` (${r.market}${r.channel ? `/${r.channel}` : ''})` : ''}`, from: 'tracked value', to: `${r.currency} ${r.price}` });
    out.push({ line, sku_code: r.sku_code, kind: problems.length ? 'conflict' : changes.length ? 'changed' : 'unchanged', changes, problems, row: r });
  });
  return out;
}

/** Writes new and changed rows (conflicts and invalid rows are skipped). */
export async function commitSkuImport(diff: DiffRow[]): Promise<{ created: number; updated: number; skipped: number }> {
  const store = await getStore();
  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const d of diff) {
    if (!d.row || (d.kind !== 'new' && d.kind !== 'changed')) {
      skipped++;
      continue;
    }
    const r = d.row;
    const brands = await store.list('brands');
    let brand = brands.find((b) => b.name.toLowerCase() === r.brand.toLowerCase());
    if (!brand) {
      const principals = await store.list('principals');
      const owner = principals.find((p) => p.name.toLowerCase() === r.brand.toLowerCase()) ?? principals[0];
      brand = (await store.insert('brands', [{ principal_id: owner.id, name: r.brand, origin_claim: null, story: null }]))[0];
    }
    const families = await store.list('product_families');
    let fam = families.find((f) => f.name.toLowerCase() === r.family.toLowerCase());
    if (!fam) fam = (await store.insert('product_families', [{ brand_id: brand.id, name: r.family, category: null, base_formulation: null, certifications: [], hs_code: r.hs_code ?? null }]))[0];
    else if (r.hs_code && !fam.hs_code) await store.update('product_families', fam.id, { hs_code: r.hs_code });
    const ml = sizeMl(r);
    const attrs = { ...r.variant_attrs, ...(ml !== undefined ? { size_ml: ml } : r.size !== undefined ? { size: r.size, size_unit: r.size_unit } : {}) };
    let sku = (await store.list('sku_configs', { sku_code: r.sku_code }))[0];
    if (!sku) {
      sku = (await store.insert('sku_configs', [{ family_id: fam.id, sku_code: r.sku_code, name: null, variant_attrs: attrs, barcode: r.barcode ?? null, shelf_life_days: r.shelf_life_days ?? null, overrides: {} }]))[0];
      created++;
    } else {
      sku = await store.update('sku_configs', sku.id, { family_id: fam.id, variant_attrs: { ...sku.variant_attrs, ...attrs }, barcode: r.barcode ?? sku.barcode, shelf_life_days: r.shelf_life_days ?? sku.shelf_life_days });
      updated++;
    }
    const packs = await store.list('pack_levels', { sku_config_id: sku.id });
    const upsertPack = async (level: 'each' | 'carton' | 'pallet', patch: Record<string, unknown>) => {
      const p = packs.find((x) => x.level === level);
      if (p) await store.update('pack_levels', p.id, patch);
      else await store.insert('pack_levels', [{ sku_config_id: sku.id, level, units_per_level: 1, l_cm: null, w_cm: null, h_cm: null, gross_kg: null, ...patch }]);
    };
    if (r.units_per_carton) await upsertPack('carton', { units_per_level: r.units_per_carton, l_cm: r.carton_l_cm ?? null, w_cm: r.carton_w_cm ?? null, h_cm: r.carton_h_cm ?? null, gross_kg: r.carton_kg ?? null });
    if (r.units_per_carton && r.cartons_per_pallet) await upsertPack('pallet', { units_per_level: r.units_per_carton * r.cartons_per_pallet });
    const markets = await store.list('markets');
    const market = r.market ? markets.find((m) => m.iso2 === r.market!.toUpperCase() || m.name.toLowerCase() === r.market!.toLowerCase()) : undefined;
    if (market && (r.label_language || r.label_file)) {
      const listing = (await store.list('market_listings', { sku_config_id: sku.id })).find((l) => l.market_id === market.id);
      const patch = { label_language: r.label_language ?? null };
      if (listing) await store.update('market_listings', listing.id, patch);
      else await store.insert('market_listings', [{ sku_config_id: sku.id, market_id: market.id, registration_status: null, halal_status: null, local_item_code: null, label_file_path: null, ...patch }]);
    }
    if (r.price !== undefined && r.price_type && r.currency) {
      const channel = market && r.channel ? (await store.list('channels', { market_id: market.id })).find((c) => c.name.toLowerCase() === r.channel!.toLowerCase()) : undefined;
      const prices = await store.list('sku_prices', { sku_config_id: sku.id });
      let price = prices.find((p) => p.price_type === r.price_type && (p.market_id ?? null) === (market?.id ?? null) && (p.channel_id ?? null) === (channel?.id ?? null));
      if (!price) price = (await store.insert('sku_prices', [{ sku_config_id: sku.id, market_id: market?.id ?? null, channel_id: channel?.id ?? null, price_type: r.price_type, currency: r.currency.toUpperCase() }]))[0];
      await store.setTrackedValue({ entity_type: 'sku_price', entity_id: price.id, field: 'price', label: `${r.sku_code} ${r.price_type}${channel ? ` at ${channel.name}` : ''}`, value_num: r.price, unit: `${r.currency.toUpperCase()}/unit`, tag: 'quoted', source_label: 'SKU import' });
    }
  }
  return { created, updated, skipped };
}
