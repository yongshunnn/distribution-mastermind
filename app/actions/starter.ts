'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import { buildSeed } from '@/lib/seed/build';
import { TABLE_ORDER, type Row, type TableName } from '@/lib/db/types';

/**
 * Loads the §12 starter data into an empty workspace as the signed-in member (RLS applies).
 * Refuses if any market already exists, so it can never overwrite real data.
 */
export async function loadStarterData(): Promise<{ ok: boolean; message: string }> {
  const store = await getStore();
  if ((await store.list('markets')).length > 0) return { ok: false, message: 'The workspace already has data — nothing loaded.' };
  const d = buildSeed();
  let n = 0;
  for (const t of TABLE_ORDER) {
    if (t === 'allowed_users') continue; // managed by the owner in SQL / Settings
    const rows = d[t] as Row<TableName>[];
    for (let i = 0; i < rows.length; i += 200) {
      await store.insert(t, rows.slice(i, i + 200) as never);
      n += Math.min(200, rows.length - i);
    }
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: `Loaded ${n} starter rows.` };
}
