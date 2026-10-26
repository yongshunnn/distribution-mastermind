import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Select } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { TrackerView } from '@/components/stage-tracker/tracker';
import { byId, rows } from '@/lib/db/data';
import { currentStage, STAGE_NAMES } from '@/lib/stages';
import { startExpansion, startTracker } from '@/app/actions/stages';

export const metadata = { title: 'Stages' };

export default async function StagesTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tracker?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [trackers, items, overrides, principals, watchouts, notes] = await Promise.all([
    rows('stage_trackers'), rows('stage_items'), rows('gate_overrides'), rows('principals'), rows('watchouts'), rows('market_watch_notes'),
  ]);
  const mt = trackers.filter((t) => t.market_id === m.id);
  const tracker = mt.find((t) => t.id === sp.tracker) ?? mt[0];
  const label = (t: (typeof mt)[number]) => `${principals.find((p) => p.id === t.principal_id)?.name ?? 'Principal'}${t.kind === 'expansion' ? ` · ${t.scope}` : ''}`;

  return (
    <div className="space-y-4">
      {mt.length > 1 ? (
        <nav aria-label="Trackers" className="flex flex-wrap gap-2">
          {mt.map((t) => {
            const st = currentStage(items.filter((i) => i.tracker_id === t.id), overrides.filter((o) => o.tracker_id === t.id));
            return (
              <Link key={t.id} href={`?tracker=${t.id}`} aria-current={t.id === tracker?.id ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm ${t.id === tracker?.id ? 'border-primary bg-accent' : 'border-border'}`}>
                {label(t)} <Badge>{st > 7 ? 'done' : `stage ${st}`}</Badge>
              </Link>
            );
          })}
        </nav>
      ) : null}

      {tracker ? (
        <>
          <p className="text-sm text-muted-foreground">
            {label(tracker)} — current stage{' '}
            {(() => {
              const st = currentStage(items.filter((i) => i.tracker_id === tracker.id), overrides.filter((o) => o.tracker_id === tracker.id), tracker.kind === 'expansion' ? Math.min(...items.filter((i) => i.tracker_id === tracker.id).map((i) => i.stage_no)) : 1);
              return st > 7 ? 'all gates passed' : `${st} · ${STAGE_NAMES[st]}`;
            })()}
            . Required items (✱) lock each gate.
          </p>
          <TrackerView tracker={tracker} items={items.filter((i) => i.tracker_id === tracker.id)} overrides={overrides.filter((o) => o.tracker_id === tracker.id)} market={m} watchouts={watchouts} notes={notes.filter((n) => n.market_id === m.id)} />
          <Disclosure summary="Start an expansion tracker (new channel, area or product)">
            <form action={startExpansion} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="parent_tracker_id" value={tracker.id} />
              <Field label="Scope" className="sm:col-span-2"><Input name="scope" required placeholder="New channel: hotels" /></Field>
              <Field label="Start at stage">
                <Select name="start_stage" defaultValue="2"><option value="2">2 · Validate</option><option value="3">3 · Route & partners</option></Select>
              </Field>
              <div className="sm:col-span-3"><Button type="submit" variant="secondary">Start expansion</Button></div>
            </form>
          </Disclosure>
        </>
      ) : (
        <Empty title={`No tracker for ${m.name} yet`} />
      )}

      <Card>
        <CardTitle>Start an entry tracker</CardTitle>
        <form action={startTracker} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="market_id" value={m.id} />
          <Field label="Principal">
            <Select name="principal_id" required>
              {principals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">Start from the 7-stage template</Button>
        </form>
      </Card>
    </div>
  );
}
