'use server';

import { revalidatePath } from 'next/cache';
import { getStore } from '@/lib/db/store';
import type { Market } from '@/lib/db/types';
import { required, s } from './util';

export async function addWatchNote(form: FormData) {
  const store = await getStore();
  const marketId = required(form, 'market_id', 'Market');
  const statusChange = s(form, 'status_change') as Market['status'] | null;
  await store.insert('market_watch_notes', [{
    market_id: marketId, headline: required(form, 'headline', 'Headline'), source: s(form, 'source'), source_url: s(form, 'source_url'),
    published_on: s(form, 'published_on'), impact: s(form, 'impact'),
    flags: { play_ids: form.getAll('play_ids').map(String), gate_ids: form.getAll('gate_ids').map(String), status_change: statusChange },
  }]);
  if (statusChange && form.get('apply_status') === 'on') await store.update('markets', marketId, { status: statusChange, blocker: s(form, 'blocker') ?? undefined });
  revalidatePath('/', 'layout');
}

export async function applyStatusChange(form: FormData) {
  const store = await getStore();
  await store.update('markets', required(form, 'market_id'), { status: required(form, 'status') as Market['status'] });
  revalidatePath('/', 'layout');
}
