'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import { trackedValueSchema } from '@/lib/validation/schemas';

export interface ActionState {
  ok: boolean;
  error?: string;
  message?: string;
}

/** Edit a tracked value: inserts a new current row and keeps the old one as history (spec §5.1). */
export async function saveTrackedValue(_prev: ActionState | null, form: FormData): Promise<ActionState> {
  const parsed = trackedValueSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  const v = parsed.data;
  // Percent inputs are typed as 8 for 8% (unit 'pct'); keep as entered.
  const store = await getStore();
  await store.setTrackedValue({ ...v, value_num: v.value_num });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Saved. Previous value kept in history.' };
}
