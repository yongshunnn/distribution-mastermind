import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, ButtonLink, Card, CardTitle, Field, Input, KV, Notice, PageHeader, Select } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { Waterfall } from '@/components/waterfall';
import { PlaySliders } from '@/components/play-sliders';
import { buildPlay, playTitle } from '@/lib/db/plays';
import { rows } from '@/lib/db/data';
import { PLAY_INPUT_KEYS } from '@/lib/calc/play';
import { TAG_LABEL } from '@/lib/calc/traced';
import { setPlayInput, updatePlay } from '@/app/actions/plays';

export const metadata = { title: 'Play' };

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Price & channel', keys: ['shelf_price', 'sales_tax_rate', 'retailer_margin', 'distributor_margin', 'rebate', 'listing_fee_total', 'listing_period_units'] },
  { title: 'Landed cost', keys: ['supplier_price', 'origin_handling_per_unit', 'freight_per_unit', 'insurance_per_unit', 'duty_rate', 'import_tax_rate', 'import_tax_recoverable', 'clearance_per_unit'] },
  { title: 'Cost to serve', keys: ['pallet_cost_per_day', 'stock_days', 'units_per_pallet', 'handling_per_order', 'units_per_order', 'delivery_cost_per_drop', 'units_per_drop', 'marketing_per_unit'] },
  { title: 'Cash & volume', keys: ['annual_finance_rate', 'receivable_days', 'payable_days', 'fixed_monthly_cost', 'volume_per_unit_m3', 'q_realistic_month', 'entry_cost'] },
];

export default async function PlayDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await buildPlay(id);
  if (!b) notFound();
  const notes = (await rows('market_watch_notes')).filter((n) => n.flags.play_ids?.includes(b.play.id));
  const e = b.econ;
  const cur = b.market.currency;
  const placeholders = PLAY_INPUT_KEYS.filter((k) => b.inputs[k].tag === 'placeholder');

  return (
    <div className="space-y-4">
      <PageHeader
        back={{ href: '/plays', label: 'Plays' }}
        title={playTitle(b)}
        subtitle={
          <span>
            <Link className="underline" href={`/markets/${b.market.id}`}>{b.market.name}</Link> · {b.channel.name} ({b.channel.channel_type.replace('_', ' ')}) · {b.segment?.outlet_type ?? 'all segments'} · {b.sku.sku_code} · route {b.play.route_type.replace(/_/g, ' ')}
          </span>
        }
        actions={<><Badge>{b.play.status}</Badge><ButtonLink href={`/supply-chain?play=${b.play.id}`}>3D chain</ButtonLink></>}
      />
      {b.warnings.map((w) => <Notice key={w} tone={w.startsWith('Negative') ? 'danger' : 'warn'}>{w}</Notice>)}
      {notes.map((n) => <Notice key={n.id} tone="info">Market watch: {n.headline}{n.impact ? ` — ${n.impact}` : ''}</Notice>)}

      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div><p className="text-xs text-muted-foreground">Contribution / unit</p><Num t={e.C} size="xl" /></div>
          <div><p className="text-xs text-muted-foreground">Per order</p><Num t={e.perOrder} size="lg" /></div>
          <div><p className="text-xs text-muted-foreground">Per month</p><Num t={e.perMonth} size="lg" /></div>
          <div><p className="text-xs text-muted-foreground">Return on cash</p><Num t={e.R} size="lg" /></div>
          <div><p className="text-xs text-muted-foreground">Break-even</p><Num t={e.breakeven} size="lg" /></div>
          <div><p className="text-xs text-muted-foreground">Value density</p><Num t={e.valueDensity} size="lg" /></div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Cost waterfall — supplier price to shelf ({cur} per unit)</CardTitle>
          <Waterfall layers={b.layers} />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardTitle>Price build-back</CardTitle>
            <dl>
              <KV label="Shelf price (incl. tax)"><Num t={b.inputs.shelf_price} /></KV>
              <KV label="Net price to us (P_net)"><Num t={e.pNet} /></KV>
              <KV label="Cost to serve + marketing (S)"><Num t={e.costToServe} /></KV>
              <KV label="Max affordable landed cost (L_max)"><Num t={e.lMax} /></KV>
              <KV label="Our landed cost (L)"><Num t={e.landed} /></KV>
              <KV label="Headroom"><Num t={e.headroom} size="lg" /></KV>
            </dl>
            {e.headroom.value < 0 ? <p className="mt-2 text-xs text-danger">Negative headroom — tap it to see which margin or cost would need to move, and by how much.</p> : null}
          </Card>
          <Card>
            <CardTitle>Break-even</CardTitle>
            <dl>
              <KV label="Fixed monthly cost (F)"><Num t={b.inputs.fixed_monthly_cost} /></KV>
              <KV label="Contribution / unit (C)"><Num t={e.C} /></KV>
              <KV label="Break-even volume"><Num t={e.breakeven} /></KV>
              <KV label="Realistic volume"><Num t={b.inputs.q_realistic_month} /></KV>
              <KV label="Peak cash tied up"><Num t={e.peakCash} /></KV>
            </dl>
          </Card>
        </div>
      </div>

      <Card>
        <CardTitle>Sensitivity — drag to restack</CardTitle>
        <PlaySliders playId={b.play.id} inputs={b.inputs} ctx={b.ctx} />
      </Card>

      <Card>
        <CardTitle>Assumptions</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">
          {placeholders.length ? `${placeholders.length} of ${PLAY_INPUT_KEYS.length} inputs are still placeholders (grey dot). ` : 'No placeholders left. '}
          Each input shows where it comes from. Editing a market or channel value changes every play there; an override applies to this play only.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <ul className="divide-y divide-border">
                {g.keys.map((k) => {
                  const key = k as (typeof PLAY_INPUT_KEYS)[number];
                  const t = b.inputs[key];
                  const l = b.lookups[key];
                  return (
                    <li key={k} className="py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 text-sm">
                          {t.label}
                          <span className="block text-xs text-muted-foreground">{TAG_LABEL[t.tag]} · {l.level === 'missing' ? 'not set' : l.where}</span>
                        </span>
                        <Num t={t} />
                      </div>
                      {t.unit !== 'flag' ? (
                        <details className="mt-1">
                          <summary className="min-h-11 cursor-pointer py-2 text-xs text-primary">Override for this play</summary>
                          <form action={setPlayInput} className="grid gap-2 sm:grid-cols-2">
                            <input type="hidden" name="play_id" value={b.play.id} />
                            <input type="hidden" name="key" value={k} />
                            <input type="hidden" name="label" value={t.label} />
                            <input type="hidden" name="unit" value={t.unit === '%' ? 'pct' : t.unit} />
                            <Field label={`Value (${t.unit === '%' ? '%' : t.unit})`}><Input name="value_num" inputMode="decimal" required defaultValue={t.unit === '%' ? Math.round(t.value * 10000) / 100 : t.value} /></Field>
                            <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
                            <Field label="Source" className="sm:col-span-2"><Input name="source_label" placeholder="e.g. Fortune buyer email 3 Nov" /></Field>
                            <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save override</Button></div>
                          </form>
                        </details>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      <Disclosure summary="Play settings">
        <form action={updatePlay} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={b.play.id} />
          <Field label="Name"><Input name="name" defaultValue={b.play.name ?? ''} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={b.play.status}>
              {['draft', 'active', 'paused', 'archived'].map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Route">
            <Select name="route_type" defaultValue={b.play.route_type}>
              {['retail_chain', 'distributor', 'full_service_distributor', 'importer_of_record', 'b2b_platform', 'co_packer', 'own_entry'].map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Certificates of origin held" hint="Unlocks preferential duty, e.g. Form D"><Input name="coo_forms" defaultValue={((b.play.assumption_overrides.coo_forms as string[]) ?? []).join(', ')} /></Field>
          <Field label="Ship-from country (ISO)" hint="Defaults to the principal's production site"><Input name="origin_iso2" maxLength={2} defaultValue={(b.play.assumption_overrides.origin_iso2 as string) ?? ''} /></Field>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save settings</Button></div>
        </form>
      </Disclosure>
    </div>
  );
}
