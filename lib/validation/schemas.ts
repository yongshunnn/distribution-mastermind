// Shared Zod schemas for forms, imports and server actions.
import { z } from 'zod';

export const TAGS = ['public', 'estimated', 'placeholder', 'quoted', 'measured', 'computed'] as const;
export const EDIT_TAGS = ['measured', 'quoted', 'estimated', 'public', 'placeholder'] as const;

const optText = z
  .string()
  .trim()
  .optional()
  .transform((s) => (s ? s : null));

const optNum = z
  .string()
  .trim()
  .optional()
  .transform((s, ctx) => {
    if (!s) return null;
    const n = Number(s.replace(/,/g, ''));
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: 'Not a number' });
      return z.NEVER;
    }
    return n;
  });

export const trackedValueSchema = z.object({
  entity_type: z.string().min(1),
  entity_id: z.string().uuid(),
  field: z.string().min(1),
  value_num: optNum,
  value_text: optText,
  unit: optText,
  label: optText,
  tag: z.enum(TAGS),
  source_label: optText,
  source_url: optText.refine((u) => !u || /^https?:\/\//.test(u), 'Must start with http(s)://'),
  as_of: optText.refine((d) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d), 'Use YYYY-MM-DD'),
  note: optText,
});

export const STAGE_STATUSES = ['not_started', 'in_progress', 'done', 'not_needed', 'blocked'] as const;

export const stageItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(STAGE_STATUSES),
  owner: optText,
  due_date: optText,
  note: optText,
});

export const shelfObservationSchema = z.object({
  market_id: z.string().uuid(),
  category: z.string().trim().min(1).default('dishwashing'),
  outlet_name: optText,
  outlet_tier: optText,
  area_id: optText,
  observed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  brand: z.string().trim().min(1, 'Brand is required'),
  owner: optText,
  pack_size: z.coerce.number().positive('Pack size must be > 0'),
  pack_unit: z.enum(['ml', 'l', 'g', 'kg']),
  price: z.coerce.number().positive('Price must be > 0'),
  currency: z.string().length(3),
  facings: optNum,
  origin: z.enum(['local', 'imported']).optional().nullable(),
  scent: optText,
  claim: optText,
  halal_logo: optText,
  label_langs: optText,
});

export const competitorSchema = z.object({
  market_id: z.string().uuid(),
  category: z.string().trim().min(1),
  brand: z.string().trim().min(1),
  owner: optText,
  pack_sizes: optText,
  positioning: optText,
  structural_strength: optText,
  weakness: optText,
  how_we_win: z.string().trim().min(3, '"How we win" is required'),
});

/** One row of the SKU import template (spec §6). */
export const skuImportRowSchema = z
  .object({
    sku_code: z.string().trim().min(1, 'sku_code is required'),
    family: z.string().trim().min(1, 'family is required'),
    brand: z.string().trim().min(1, 'brand is required'),
    barcode: z.string().trim().optional(),
    size: z.coerce.number().positive().optional(),
    size_unit: z.string().trim().optional(),
    units_per_carton: z.coerce.number().int().positive().optional(),
    carton_l_cm: z.coerce.number().positive().optional(),
    carton_w_cm: z.coerce.number().positive().optional(),
    carton_h_cm: z.coerce.number().positive().optional(),
    carton_kg: z.coerce.number().positive().optional(),
    cartons_per_pallet: z.coerce.number().int().positive().optional(),
    shelf_life_days: z.coerce.number().int().positive().optional(),
    hs_code: z.string().trim().optional(),
    market: z.string().trim().optional(),
    channel: z.string().trim().optional(),
    price_type: z.enum(['supplier_exw', 'fob', 'list', 'shelf']).optional(),
    price: z.coerce.number().nonnegative().optional(),
    currency: z.string().trim().length(3).optional(),
    label_language: z.string().trim().optional(),
    label_file: z.string().trim().optional(),
    variant_attrs: z.record(z.string(), z.string()).default({}),
  })
  .refine((r) => r.price === undefined || (r.price_type && r.currency), { message: 'price needs price_type and currency' });

export type SkuImportRow = z.infer<typeof skuImportRowSchema>;
