// SKU import template (spec §6). Columns starting "variant_attr:" become variant axes.
export const SKU_TEMPLATE_COLUMNS = [
  'sku_code', 'family', 'brand', 'variant_attr:scent', 'variant_attr:formulation', 'barcode', 'size', 'size_unit', 'units_per_carton',
  'carton_l_cm', 'carton_w_cm', 'carton_h_cm', 'carton_kg', 'cartons_per_pallet', 'shelf_life_days', 'hs_code', 'market', 'channel',
  'price_type', 'price', 'currency', 'label_language', 'label_file',
];

export const SALES_TEMPLATE_COLUMNS = ['sku_code', 'market', 'channel', 'month', 'units', 'value', 'currency', 'source'];

/** Normalise a raw spreadsheet row: trims keys, drops empty strings, gathers variant_attr:* into one object. */
export function normaliseSkuRow(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { variant_attrs: {} as Record<string, string> };
  for (const [k0, v0] of Object.entries(raw)) {
    const k = k0.trim();
    const v = typeof v0 === 'string' ? v0.trim() : v0;
    if (v === '' || v === null || v === undefined) continue;
    if (k.toLowerCase().startsWith('variant_attr:')) (out.variant_attrs as Record<string, string>)[k.slice('variant_attr:'.length).trim()] = String(v);
    else out[k.toLowerCase()] = typeof v === 'number' ? String(v) : v;
  }
  return out;
}
