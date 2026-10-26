import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Select, Textarea } from '@/components/ui';
import { AddValueForm, Disclosure, TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { ValueTable } from '@/components/value-table';
import { byId, rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';
import { addArea, addChannel, addSegment } from '@/app/actions/markets';

export const metadata = { title: 'Channels & segments' };

const TYPES = ['retail_chain', 'b2b_platform', 'distributor', 'wholesale', 'direct_van', 'ecommerce'] as const;

export default async function ChannelsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, segments, channels, terms, areas, plays] = await Promise.all([
    valueIndex(), rows('segments'), rows('channels'), rows('channel_terms'), rows('market_areas'), buildAllPlays(),
  ]);
  const segs = segments.filter((s) => s.market_id === m.id);
  const chans = channels.filter((c) => c.market_id === m.id);
  const ars = areas.filter((a) => a.market_id === m.id);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Segments</CardTitle>
        {segs.length ? (
          <ul className="divide-y divide-border">
            {segs.map((s) => {
              const oc = idx.get('segment', s.id, 'outlet_count');
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm">{s.outlet_type}</span>
                  {oc ? <Num t={tracedFromValue(oc, idx)} /> : <span className="text-xs text-muted-foreground">size unknown</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No segments yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Add a segment">
            <form action={addSegment} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="market_id" value={m.id} />
              <Field label="Outlet type"><Input name="outlet_type" required placeholder="Hotels" /></Field>
              <Field label="Outlet count"><Input name="outlet_count" inputMode="numeric" /></Field>
              <Field label="Area">
                <Select name="area_id" defaultValue="">
                  <option value="">Whole market</option>
                  {ars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </Field>
              <Field label="Tag"><TagSelect /></Field>
              <Field label="Source" className="sm:col-span-2"><Input name="source_label" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Add segment</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Channels</h2>
        {chans.length ? null : <Empty title="No channels yet" />}
        {chans.map((c) => {
          const ct = terms.filter((t) => t.channel_id === c.id);
          const cp = plays.filter((p) => p.channel.id === c.id);
          return (
            <Card key={c.id}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{c.name}</h3>
                <span className="flex gap-1">
                  <Badge>{c.channel_type.replace('_', ' ')}</Badge>
                  {c.has_distributor_tier ? <Badge tone="info">via distributor</Badge> : null}
                </span>
              </div>
              {c.notes ? <p className="mb-2 text-sm text-muted-foreground">{c.notes}</p> : null}
              <p className="text-xs text-muted-foreground">
                Serves: {c.segment_ids.map((sid) => segs.find((s) => s.id === sid)?.outlet_type).filter(Boolean).join(', ') || '—'}
              </p>
              <div className="mt-2 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Channel facts</p>
                  <ValueTable values={idx.forEntity('channel', c.id)} idx={idx} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Terms</p>
                  {ct.map((t) => (
                    <div key={t.id}>
                      {t.delivery_mode ? <p className="text-xs text-muted-foreground">Delivery: {t.delivery_mode}</p> : null}
                      <ValueTable values={idx.forEntity('channel_terms', t.id)} idx={idx} />
                      <div className="mt-2"><AddValueForm entityType="channel_terms" entityId={t.id} title="Add a term" /></div>
                    </div>
                  ))}
                </div>
              </div>
              {cp.length ? (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Plays</p>
                  <ul>
                    {cp.map((p) => (
                      <li key={p.play.id} className="flex items-center justify-between py-1">
                        <Link href={`/plays/${p.play.id}`} className="text-sm hover:underline">{playTitle(p)}</Link>
                        <Num t={p.econ.C} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Card>
          );
        })}
        <Disclosure summary="Add a channel">
          <form action={addChannel} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="market_id" value={m.id} />
            <Field label="Name"><Input name="name" required placeholder="Mydin" /></Field>
            <Field label="Type">
              <Select name="channel_type" defaultValue="retail_chain">
                {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </Select>
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-medium text-muted-foreground">Segments served</legend>
              <div className="mt-1 flex flex-wrap gap-3">
                {segs.map((s) => (
                  <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="segment_ids" value={s.id} className="size-5" /> {s.outlet_type}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="has_distributor_tier" className="size-5" /> A distributor sits between us and this channel
            </label>
            <Field label="Channel margin (%)"><Input name="retailer_margin" inputMode="decimal" placeholder="leave empty if unknown" /></Field>
            <Field label="Payment days"><Input name="receivable_days" inputMode="numeric" /></Field>
            <Field label={`Listing fees (${m.currency})`}><Input name="listing_fee_total" inputMode="decimal" /></Field>
            <Field label="Delivery mode"><Input name="delivery_mode" placeholder="DC / store / pick-up" /></Field>
            <Field label="Source of terms" className="sm:col-span-2"><Input name="source_label" /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" /></Field>
            <div className="sm:col-span-2"><Button type="submit">Add channel</Button></div>
          </form>
        </Disclosure>
      </div>

      <Card>
        <CardTitle>Areas</CardTitle>
        {ars.length ? (
          <ul className="divide-y divide-border">
            {ars.map((a) => {
              const pop = idx.get('market_area', a.id, 'population');
              const hh = idx.get('market_area', a.id, 'households');
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>{a.name}</span>
                  <span className="flex gap-3">
                    {pop ? <Num t={tracedFromValue(pop, idx)} /> : null}
                    {hh ? <Num t={tracedFromValue(hh, idx)} /> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No areas yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Add an area">
            <form action={addArea} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="market_id" value={m.id} />
              <Field label="Name"><Input name="name" required /></Field>
              <Field label="Population"><Input name="population" inputMode="numeric" /></Field>
              <Field label="Households"><Input name="households" inputMode="numeric" /></Field>
              <Field label="Tag"><TagSelect defaultValue="public" /></Field>
              <Field label="Source" className="sm:col-span-2"><Input name="source_label" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Add area</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>
    </div>
  );
}
