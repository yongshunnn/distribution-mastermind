'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getStore } from '@/lib/db/store';
import { uploadFile } from '@/lib/storage';
import { currentStage, gateStates } from '@/lib/stages';
import { stageItemSchema } from '@/lib/validation/schemas';
import { n, required, s } from './util';

async function syncStage(trackerId: string) {
  const store = await getStore();
  const [tracker, items, overrides] = await Promise.all([
    store.get('stage_trackers', trackerId), store.list('stage_items', { tracker_id: trackerId }), store.list('gate_overrides', { tracker_id: trackerId }),
  ]);
  if (!tracker) return;
  const start = tracker.kind === 'expansion' ? Math.min(...items.map((i) => i.stage_no), 7) : 1;
  const stage = currentStage(items, overrides, start);
  if (stage !== tracker.current_stage) await store.update('stage_trackers', trackerId, { current_stage: stage });
}

export async function startTracker(form: FormData) {
  const store = await getStore();
  const marketId = required(form, 'market_id');
  const principalId = required(form, 'principal_id', 'Principal');
  const [tracker] = await store.insert('stage_trackers', [{ market_id: marketId, principal_id: principalId, kind: 'entry', scope: null, parent_tracker_id: null, current_stage: 1, status: 'active' }]);
  const tpl = await store.list('stage_items_template');
  await store.insert('stage_items', tpl.sort((a, b) => a.sort - b.sort).map((t, i) => ({
    tracker_id: tracker.id, stage_no: t.stage_no, item: t.item, required: t.required, status: 'not_started' as const, watch_out: t.watch_out, sort: i,
    owner: null, due_date: null, evidence_path: null, note: null,
  })));
  revalidatePath('/', 'layout');
  redirect(`/markets/${marketId}/stages?tracker=${tracker.id}`);
}

/** Expansion (new channel / area / product in a live market): new tracker from stage 2 or 3, copying done items. */
export async function startExpansion(form: FormData) {
  const store = await getStore();
  const parentId = required(form, 'parent_tracker_id');
  const parent = await store.get('stage_trackers', parentId);
  if (!parent) throw new Error('Tracker not found');
  const startStage = Math.max(2, Math.min(3, n(form, 'start_stage') ?? 2));
  const [tracker] = await store.insert('stage_trackers', [{
    market_id: parent.market_id, principal_id: parent.principal_id, kind: 'expansion', scope: required(form, 'scope', 'Scope'),
    parent_tracker_id: parent.id, current_stage: startStage, status: 'active',
  }]);
  const parentItems = await store.list('stage_items', { tracker_id: parent.id });
  const tpl = await store.list('stage_items_template');
  await store.insert('stage_items', tpl.filter((t) => t.stage_no >= startStage).sort((a, b) => a.sort - b.sort).map((t, i) => {
    const prev = parentItems.find((p) => p.item === t.item && p.status === 'done');
    return {
      tracker_id: tracker.id, stage_no: t.stage_no, item: t.item, required: t.required, status: prev ? ('done' as const) : ('not_started' as const),
      watch_out: t.watch_out, sort: i, owner: null, due_date: null, evidence_path: prev?.evidence_path ?? null, note: prev ? 'Copied as done from the parent tracker.' : null,
    };
  }));
  revalidatePath('/', 'layout');
  redirect(`/markets/${parent.market_id}/stages?tracker=${tracker.id}`);
}

export async function updateStageItem(form: FormData) {
  const parsed = stageItemSchema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === 'string')));
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join('; '));
  const store = await getStore();
  const item = await store.get('stage_items', parsed.data.id);
  if (!item) throw new Error('Item not found');
  let evidence = item.evidence_path;
  const file = form.get('evidence');
  if (file instanceof File && file.size > 0) evidence = await uploadFile(`evidence/${item.tracker_id}`, file);
  await store.update('stage_items', item.id, { status: parsed.data.status, owner: parsed.data.owner, due_date: parsed.data.due_date, note: parsed.data.note, evidence_path: evidence });
  await syncStage(item.tracker_id);
  revalidatePath('/', 'layout');
}

export async function addStageItem(form: FormData) {
  const store = await getStore();
  const trackerId = required(form, 'tracker_id');
  await store.insert('stage_items', [{
    tracker_id: trackerId, stage_no: n(form, 'stage_no') ?? 1, item: required(form, 'item', 'Item'), required: form.get('required') === 'on',
    status: 'not_started', watch_out: s(form, 'watch_out'), sort: 999, owner: s(form, 'owner'), due_date: s(form, 'due_date'), evidence_path: null, note: null,
  }]);
  await syncStage(trackerId);
  revalidatePath('/', 'layout');
}

/** Passing a gate with open required items needs a written reason (gate_overrides). */
export async function overrideGate(form: FormData) {
  const store = await getStore();
  const trackerId = required(form, 'tracker_id');
  const stage = n(form, 'stage_no') ?? 1;
  const reason = required(form, 'reason', 'Reason');
  const items = await store.list('stage_items', { tracker_id: trackerId });
  const overrides = await store.list('gate_overrides', { tracker_id: trackerId });
  const gate = gateStates(items, overrides).find((g) => g.stage === stage);
  if (gate && gate.openRequired.length === 0) return;
  await store.insert('gate_overrides', [{ tracker_id: trackerId, stage_no: stage, reason, by: (await store.userEmail()) ?? 'demo user', at: new Date().toISOString() }]);
  await syncStage(trackerId);
  revalidatePath('/', 'layout');
}

export async function addWatchout(form: FormData) {
  const store = await getStore();
  await store.insert('watchouts', [{ text: required(form, 'text', 'Text'), stage_no: n(form, 'stage_no'), category: s(form, 'category') ?? 'learned', learned_from_market_id: s(form, 'market_id') }]);
  revalidatePath('/', 'layout');
}

export async function setTrackerStatus(form: FormData) {
  const store = await getStore();
  await store.update('stage_trackers', required(form, 'id'), { status: required(form, 'status') });
  revalidatePath('/', 'layout');
}
