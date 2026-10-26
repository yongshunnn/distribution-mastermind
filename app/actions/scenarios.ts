'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { n, required } from './util';

export async function saveScenario(form: FormData) {
  const store = await getStore();
  const id = form.get('id') ? String(form.get('id')) : null;
  const row = {
    name: required(form, 'name', 'Name'),
    play_ids: form.getAll('play_ids').map(String),
    limits: { capital: n(form, 'capital'), wc_limit: n(form, 'wc_limit'), people: n(form, 'people'), pallets: n(form, 'pallets') },
    overrides: {},
  };
  const saved = id ? await store.update('scenarios', id, row) : (await store.insert('scenarios', [row]))[0];
  revalidatePath('/', 'layout');
  redirect(`/scenarios/${saved.id}`);
}

export async function deleteScenario(form: FormData) {
  const store = await getStore();
  await store.remove('scenarios', required(form, 'id'));
  revalidatePath('/', 'layout');
  redirect('/scenarios');
}
