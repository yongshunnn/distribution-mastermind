'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { uploadFile } from '@/lib/storage';
import type { RouteType } from '@/lib/db/types';
import { n, required, s } from './util';

export async function addPartner(form: FormData) {
  const store = await getStore();
  const [p] = await store.insert('partners', [{
    market_id: s(form, 'market_id'),
    name: required(form, 'name', 'Name'),
    roles: form.getAll('roles').map(String) as RouteType[],
    reach: s(form, 'reach'),
    competing_lines: s(form, 'competing_lines'),
    contact: s(form, 'contact'),
    deal_stage: s(form, 'deal_stage') ?? 'identified',
    score: n(form, 'score'),
    notes: s(form, 'notes'),
  }]);
  revalidatePath('/', 'layout');
  if (form.get('go') === 'detail') redirect(`/partners/${p.id}`);
}

export async function updatePartner(form: FormData) {
  const store = await getStore();
  await store.update('partners', required(form, 'id'), {
    deal_stage: s(form, 'deal_stage') ?? 'identified',
    score: n(form, 'score'),
    reach: s(form, 'reach'),
    competing_lines: s(form, 'competing_lines'),
    contact: s(form, 'contact'),
    notes: s(form, 'notes'),
  });
  revalidatePath('/', 'layout');
}

export async function addAsk(form: FormData) {
  const store = await getStore();
  await store.insert('partner_asks', [{
    partner_id: required(form, 'partner_id'),
    metric: required(form, 'metric', 'Metric'),
    value: n(form, 'value'),
    value_text: s(form, 'value_text'),
    unit: s(form, 'unit'),
    asked_on: s(form, 'asked_on') ?? new Date().toISOString().slice(0, 10),
    note: s(form, 'note'),
  }]);
  revalidatePath('/', 'layout');
}

export async function addDocument(form: FormData) {
  const store = await getStore();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a file');
  const entityType = required(form, 'entity_type');
  const entityId = required(form, 'entity_id');
  const path = await uploadFile(`${entityType}/${entityId}`, file);
  await store.insert('documents', [{ entity_type: entityType, entity_id: entityId, kind: s(form, 'kind'), name: file.name, path: path!, uploaded_at: new Date().toISOString() }]);
  revalidatePath('/', 'layout');
}
