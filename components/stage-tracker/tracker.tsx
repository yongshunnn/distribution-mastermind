import Link from 'next/link';
import { Badge, Button, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { Num } from '@/components/num';
import { addStageItem, addWatchout, overrideGate, updateStageItem } from '@/app/actions/stages';
import { gateStates, isOverdue, STAGE_NAMES, STATUS_LABEL } from '@/lib/stages';
import { count } from '@/lib/calc/traced';
import { fileUrl } from '@/lib/storage';
import type { GateOverride, Market, MarketWatchNote, StageItem, StageTracker, Watchout } from '@/lib/db/types';

const TONE: Record<StageItem['status'], 'neutral' | 'info' | 'ok' | 'danger'> = {
  not_started: 'neutral', in_progress: 'info', done: 'ok', not_needed: 'ok', blocked: 'danger',
};

export function TrackerView({ tracker, items, overrides, market, watchouts, notes }: {
  tracker: StageTracker; items: StageItem[]; overrides: GateOverride[]; market: Market; watchouts: Watchout[]; notes: MarketWatchNote[];
}) {
  const gates = gateStates(items, overrides);
  const stages = [...new Set(items.map((i) => i.stage_no))].sort((a, b) => a - b);
  const libraryTexts = new Set(watchouts.map((w) => w.text.toLowerCase()));
  const flaggedGateIds = new Set(notes.flatMap((n) => n.flags.gate_ids ?? []));
  const current = gates.find((g) => g.stage >= (stages[0] ?? 1) && !g.passed)?.stage;

  return (
    <div className="space-y-3" data-testid="tracker">
      {market.status === 'paused' ? <Notice tone="warn">Market paused — progress is kept. Blocker: {market.blocker}</Notice> : null}
      {stages.map((st) => {
        const g = gates.find((x) => x.stage === st)!;
        const its = items.filter((i) => i.stage_no === st).sort((a, b) => a.sort - b.sort);
        return (
          <details key={st} className="rounded-xl border border-border bg-card" open={st === current}>
            <summary className="flex min-h-14 cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="font-medium">{st} · {STAGE_NAMES[st]}</span>
              <span className="flex flex-wrap items-center gap-1 text-xs">
                <Num t={count(`stage_${st}_done`, g.done, `Stage ${st} items closed`, 'Items done or not needed in this stage.')} />
                <span className="text-muted-foreground">/</span>
                <Num t={count(`stage_${st}_total`, g.total, `Stage ${st} items`, 'All items in this stage.')} />
                {g.overridden ? <Badge tone="warn">Gate overridden</Badge> : g.passed ? <Badge tone="ok">Gate passed</Badge> : <Badge tone="neutral">Locked</Badge>}
                {g.blocked ? <Badge tone="danger">Blocked</Badge> : null}
              </span>
            </summary>
            <div className="space-y-2 border-t border-border p-3">
              {its.map((i) => (
                <details key={i.id} id={`item-${i.id}`} className="rounded-lg border border-border">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 text-sm">
                      {i.item}
                      {i.required ? <span className="text-danger" title="Required"> ✱</span> : null}
                      {flaggedGateIds.has(i.id) ? <Badge tone="warn" className="ml-1">watch note</Badge> : null}
                      {i.watch_out ? <span className="block text-xs text-warn">Watch out: {i.watch_out}</span> : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={TONE[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                      {isOverdue(i) ? <Badge tone="warn">Overdue</Badge> : null}
                    </span>
                  </summary>
                  <form action={updateStageItem} className="grid gap-2 border-t border-border p-3 sm:grid-cols-2" data-testid="stage-item-form">
                    <input type="hidden" name="id" value={i.id} />
                    <Field label="Status">
                      <Select name="status" defaultValue={i.status}>
                        {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </Select>
                    </Field>
                    <Field label="Owner"><Input name="owner" defaultValue={i.owner ?? ''} /></Field>
                    <Field label="Due date"><Input name="due_date" type="date" defaultValue={i.due_date ?? ''} /></Field>
                    <Field label="Evidence">
                      <input name="evidence" type="file" className="block min-h-11 w-full text-sm" />
                    </Field>
                    <Field label="Note" className="sm:col-span-2"><Textarea name="note" defaultValue={i.note ?? ''} /></Field>
                    {i.evidence_path ? (
                      <p className="text-xs sm:col-span-2"><Link className="underline" href={fileUrl(i.evidence_path)} target="_blank">View evidence</Link></p>
                    ) : null}
                    <div className="sm:col-span-2"><Button type="submit">Save</Button></div>
                  </form>
                  {i.status === 'blocked' && !libraryTexts.has(`${i.item}: ${i.note ?? ''}`.toLowerCase()) && !(i.watch_out && libraryTexts.has(i.watch_out.toLowerCase())) ? (
                    <form action={addWatchout} className="flex flex-wrap items-end gap-2 border-t border-border p-3">
                      <input type="hidden" name="stage_no" value={i.stage_no} />
                      <input type="hidden" name="market_id" value={market.id} />
                      <Field label="Add to watch-out library" className="min-w-0 flex-1">
                        <Input name="text" defaultValue={i.watch_out ?? `${i.item}: ${i.note ?? ''}`} />
                      </Field>
                      <Button type="submit" variant="secondary">Add</Button>
                    </form>
                  ) : null}
                </details>
              ))}

              {g.openRequired.length && !g.overridden ? (
                <details className="rounded-lg bg-warn-bg p-3 text-sm text-warn">
                  <summary className="min-h-11 cursor-pointer">Pass this gate with open required items…</summary>
                  <form action={overrideGate} className="mt-2 space-y-2">
                    <input type="hidden" name="tracker_id" value={tracker.id} />
                    <input type="hidden" name="stage_no" value={st} />
                    <p>Open: {g.openRequired.map((x) => x.item).join('; ')}</p>
                    <Textarea name="reason" required placeholder="Why it is safe to move on" />
                    <Button type="submit" variant="secondary">Log override and pass gate</Button>
                  </form>
                </details>
              ) : null}
              {g.overridden ? (
                <div className="rounded-lg bg-warn-bg p-3 text-sm text-warn">
                  <p>Override by {g.overridden.by} on {g.overridden.at.slice(0, 10)}: {g.overridden.reason}</p>
                  {!libraryTexts.has(g.overridden.reason.toLowerCase()) ? (
                    <form action={addWatchout} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="stage_no" value={st} />
                      <input type="hidden" name="market_id" value={market.id} />
                      <Input name="text" defaultValue={g.overridden.reason} className="min-w-0 flex-1" aria-label="Watch-out text" />
                      <Button type="submit" variant="secondary">Add to watch-out library</Button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              <details className="rounded-lg border border-dashed border-border">
                <summary className="min-h-11 cursor-pointer px-3 py-2 text-sm text-muted-foreground">Add an item to stage {st}</summary>
                <form action={addStageItem} className="grid gap-2 p-3 sm:grid-cols-2">
                  <input type="hidden" name="tracker_id" value={tracker.id} />
                  <input type="hidden" name="stage_no" value={st} />
                  <Field label="Item" className="sm:col-span-2"><Input name="item" required /></Field>
                  <Field label="Watch-out"><Input name="watch_out" /></Field>
                  <Field label="Due"><Input name="due_date" type="date" /></Field>
                  <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="required" className="size-5" /> Required for the gate</label>
                  <div><Button type="submit" variant="secondary">Add item</Button></div>
                </form>
              </details>
            </div>
          </details>
        );
      })}
    </div>
  );
}
