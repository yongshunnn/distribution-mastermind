'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import { commitSkuImport, diffSkuImport, type DiffRow } from '@/lib/import/sku';
import { snapshot } from '@/lib/db/principals';
import { uploadFile } from '@/lib/storage';
import { list, n, required, s } from './util';

export async function previewSkuImport(rows: Record<string, unknown>[]): Promise<DiffRow[]> {
  return diffSkuImport(rows.slice(0, 5000));
}

export async function applySkuImport(rows: Record<string, unknown>[], principalId?: string): Promise<{ created: number; updated: number; skipped: number }> {
  const diff = await diffSkuImport(rows.slice(0, 5000));
  const res = await commitSkuImport(diff);
  if (principalId) await snapshot(principalId, 3);
  revalidatePath('/', 'layout');
  return res;
}

/** Label artwork from a zip: each file name (without extension) must match a sku_code. */
export async function uploadLabel(form: FormData): Promise<{ sku_code: string; ok: boolean; error?: string }> {
  const store = await getStore();
  const file = form.get('file');
  const code = String(form.get('sku_code') ?? '');
  if (!(file instanceof File)) return { sku_code: code, ok: false, error: 'No file' };
  const sku = (await store.list('sku_configs', { sku_code: code }))[0];
  if (!sku) return { sku_code: code, ok: false, error: 'No SKU with this code' };
  const path = await uploadFile(`labels/${sku.sku_code}`, file);
  await store.insert('documents', [{ entity_type: 'sku_config', entity_id: sku.id, kind: 'label', name: file.name, path: path!, uploaded_at: new Date().toISOString() }]);
  for (const l of await store.list('market_listings', { sku_config_id: sku.id })) await store.update('market_listings', l.id, { label_file_path: path });
  revalidatePath('/', 'layout');
  return { sku_code: code, ok: true };
}

/** Bulk edit attributes shared by every SKU in a family (inherited unless overridden). */
export async function updateFamily(form: FormData) {
  const store = await getStore();
  await store.update('product_families', required(form, 'id'), {
    name: required(form, 'name', 'Name'), category: s(form, 'category'), base_formulation: s(form, 'base_formulation'),
    certifications: list(form, 'certifications'), hs_code: s(form, 'hs_code'),
  });
  revalidatePath('/', 'layout');
}

export async function addFamily(form: FormData) {
  const store = await getStore();
  await store.insert('product_families', [{ brand_id: required(form, 'brand_id', 'Brand'), name: required(form, 'name', 'Name'), category: s(form, 'category'), base_formulation: s(form, 'base_formulation'), certifications: list(form, 'certifications'), hs_code: s(form, 'hs_code') }]);
  revalidatePath('/', 'layout');
}

export async function addSku(form: FormData) {
  const store = await getStore();
  const sizeMl = n(form, 'size_ml');
  const scent = s(form, 'scent');
  const [sku] = await store.insert('sku_configs', [{
    family_id: required(form, 'family_id'), sku_code: required(form, 'sku_code', 'SKU code'), name: s(form, 'name'),
    variant_attrs: { ...(sizeMl ? { size_ml: sizeMl } : {}), ...(scent ? { scent } : {}) }, barcode: s(form, 'barcode'), shelf_life_days: n(form, 'shelf_life_days'), overrides: {},
  }]);
  const upc = n(form, 'units_per_carton');
  if (upc) {
    await store.insert('pack_levels', [{ sku_config_id: sku.id, level: 'carton', units_per_level: upc, l_cm: n(form, 'carton_l_cm'), w_cm: n(form, 'carton_w_cm'), h_cm: n(form, 'carton_h_cm'), gross_kg: n(form, 'carton_kg') }]);
    const cpp = n(form, 'cartons_per_pallet');
    if (cpp) await store.insert('pack_levels', [{ sku_config_id: sku.id, level: 'pallet', units_per_level: upc * cpp, l_cm: null, w_cm: null, h_cm: null, gross_kg: null }]);
  }
  revalidatePath('/', 'layout');
}

export async function savePack(form: FormData) {
  const store = await getStore();
  const id = s(form, 'id');
  const row = { units_per_level: n(form, 'units_per_level') ?? 1, l_cm: n(form, 'l_cm'), w_cm: n(form, 'w_cm'), h_cm: n(form, 'h_cm'), gross_kg: n(form, 'gross_kg') };
  if (id) await store.update('pack_levels', id, row);
  else await store.insert('pack_levels', [{ sku_config_id: required(form, 'sku_config_id'), level: required(form, 'level') as 'each', ...row }]);
  revalidatePath('/', 'layout');
}

/** Overrides: SKU-level values that differ from the family (e.g. a different HS code). */
export async function saveSkuOverride(form: FormData) {
  const store = await getStore();
  const sku = await store.get('sku_configs', required(form, 'id'));
  if (!sku) throw new Error('SKU not found');
  const key = required(form, 'key', 'Attribute');
  const value = s(form, 'value');
  const overrides = { ...sku.overrides };
  if (value === null) delete overrides[key];
  else overrides[key] = value;
  await store.update('sku_configs', sku.id, { overrides });
  revalidatePath('/', 'layout');
}
