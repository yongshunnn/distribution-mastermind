import Link from 'next/link';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { rows } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';
import { addWatchNote, applyStatusChange } from '@/app/actions/watch';

export const metadata = { title: 'Market watch' };

export default async function WatchPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const sp = await searchParams;
  const [notes, markets, plays, items, trackers] = await Promise.all([rows('market_watch_notes'), rows('markets'), buildAllPlays(), rows('stage_items'), rows('stage_trackers')]);
  const marketId = sp.market ?? markets.find((m) => m.status === 'exploring')?.id ?? markets[0]?.id;
  const sorted = [...notes].sort((a, b) => ((a.published_on ?? a.created_at) < (b.published_on ?? b.created_at) ? 1 : -1));
  const mItems = items.filter((i) => trackers.some((t) => t.id === i.tracker_id && t.market_id === marketId) && i.status !== 'done');
  return (
    <div className="space-y-4">
      <PageHeader title="Market watch" subtitle="News and regulation notes per market. A note can flag plays, stage gates or a change of market status." />
      <Card>
        <CardTitle>Add a note</CardTitle>
        <form method="get" className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="Market"><Select name="market" defaultValue={marketId}>{markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
          <Button type="submit" variant="secondary">Switch</Button>
        </form>
        <form action={addWatchNote} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="market_id" value={marketId} />
          <Field label="Headline" className="sm:col-span-2"><Input name="headline" required /></Field>
          <Field label="Source"><Input name="source" /></Field>
          <Field label="Published"><Input name="published_on" type="date" /></Field>
          <Field label="Link" className="sm:col-span-2"><Input name="source_url" type="url" /></Field>
          <Field label="Impact" className="sm:col-span-2"><Textarea name="impact" placeholder="What changes for us" /></Field>
          <Disclosure summary="Flag plays">
            {plays.filter((p) => p.market.id === marketId).map((p) => (
              <label key={p.play.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="play_ids" value={p.play.id} className="size-5" />{playTitle(p)}</label>
            ))}
          </Disclosure>
          <Disclosure summary="Flag stage gates">
            {mItems.slice(0, 40).map((i) => (
              <label key={i.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="gate_ids" value={i.id} className="size-5" />S{i.stage_no} · {i.item}</label>
            ))}
          </Disclosure>
          <Field label="Suggest market status">
            <Select name="status_change" defaultValue=""><option value="">No change</option><option value="active">Active</option><option value="exploring">Exploring</option><option value="paused">Paused</option></Select>
          </Field>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="apply_status" className="size-5" /> Apply the status now</label>
          <div className="sm:col-span-2"><Button type="submit">Save note</Button></div>
        </form>
      </Card>
      {sorted.length ? (
        <ul className="space-y-3">
          {sorted.map((n) => {
            const m = markets.find((x) => x.id === n.market_id);
            return (
              <li key={n.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium">{n.headline}</p>
                    <Badge>{m?.name}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {n.source_url ? <a className="underline" href={n.source_url} target="_blank" rel="noreferrer">{n.source ?? 'source'}</a> : n.source}
                    {n.published_on ? ` · ${n.published_on}` : ''}
                  </p>
                  {n.impact ? <p className="mt-1 text-sm">{n.impact}</p> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(n.flags.play_ids ?? []).map((pid) => {
                      const p = plays.find((x) => x.play.id === pid);
                      return p ? <Link key={pid} href={`/plays/${pid}`}><Badge tone="warn">play: {playTitle(p)}</Badge></Link> : null;
                    })}
                    {(n.flags.gate_ids ?? []).map((gid) => {
                      const i = items.find((x) => x.id === gid);
                      return i ? <Link key={gid} href={`/markets/${n.market_id}/stages?tracker=${i.tracker_id}#item-${gid}`}><Badge tone="warn">gate: {i.item}</Badge></Link> : null;
                    })}
                  </div>
                  {n.flags.status_change && m && m.status !== n.flags.status_change ? (
                    <form action={applyStatusChange} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="market_id" value={m.id} />
                      <input type="hidden" name="status" value={n.flags.status_change} />
                      <span className="text-sm">Suggests {m.name} → {n.flags.status_change}</span>
                      <Button type="submit" variant="secondary">Apply</Button>
                    </form>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty title="No notes yet" />
      )}
    </div>
  );
}
