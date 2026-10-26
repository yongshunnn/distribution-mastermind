'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import { uploadFile } from '@/lib/storage';
import { competitorSchema, shelfObservationSchema } from '@/lib/validation/schemas';
import type { ActionState } from './values';

export async function addObservation(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const raw = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string'));
  const parsed = shelfObservationSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  const o = parsed.data;
  const store = await getStore();
  let photo: string | null = null;
  const file = form.get('photo');
  if (file instanceof File && file.size > 0) photo = await uploadFile(`audits/${o.market_id}`, file);
  const attributes = Object.fromEntries(
    Object.entries({ scent: o.scent, claim: o.claim, halal_logo: o.halal_logo, label_langs: o.label_langs }).filter(([, v]) => v),
  );
  await store.insert('shelf_observations', [{
    market_id: o.market_id, category: o.category, outlet_name: o.outlet_name, outlet_tier: o.outlet_tier, area_id: o.area_id,
    observed_on: o.observed_on, brand: o.brand, owner: o.owner, pack_size: o.pack_size, pack_unit: o.pack_unit, price: o.price,
    currency: o.currency.toUpperCase(), facings: o.facings, attributes, origin: o.origin ?? null, photo_path: photo,
  }]);
  revalidatePath('/', 'layout');
  return { ok: true, message: `Saved ${o.brand} ${o.pack_size}${o.pack_unit}. Ready for the next one.` };
}

export async function addCompetitor(form: FormData) {
  const parsed = competitorSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const c = parsed.data;
  const store = await getStore();
  await store.insert('competitor_brands', [{
    ...c,
    pack_sizes: (c.pack_sizes ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean),
  }]);
  revalidatePath('/', 'layout');
}

export async function deleteObservation(form: FormData) {
  const store = await getStore();
  await store.remove('shelf_observations', String(form.get('id')));
  revalidatePath('/', 'layout');
}
