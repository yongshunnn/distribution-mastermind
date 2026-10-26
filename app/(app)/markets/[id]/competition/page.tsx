import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, ButtonLink, Card, CardTitle, Empty, Field, Input, Textarea } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { ValueTable } from '@/components/value-table';
import { byId, rows, settings, valueIndex } from '@/lib/db/data';
import { auditSummary, pricePerBase, type Observation } from '@/lib/calc/audit';
import { parseSize, rangeGaps, type SizeRef } from '@/lib/calc/rangegap';
import { leaf } from '@/lib/calc/traced';
import { addCompetitor, deleteObservation } from '@/app/actions/competition';
import { fileUrl } from '@/lib/storage';

export const metadata = { title: 'Competition' };

const AUDIT_PREFIXES = ['audit_', 'mfr_share', 'scent_', 'gateway_', 'eye_level', 'target_shelf'];

export default async function CompetitionTab({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, obsAll, comps, skus, families, cfg] = await Promise.all([
    valueIndex(), rows('shelf_observations'), rows('competitor_brands'), rows('sku_configs'), rows('product_families'), settings(),
  ]);
  const width = Number(sp.w ?? cfg.clusterWidthPct) || cfg.clusterWidthPct;
  const obs = obsAll.filter((o) => o.market_id === m.id).sort((a, b) => (a.observed_on < b.observed_on ? 1 : -1));
  const categories = [...new Set([...obs.map((o) => o.category), ...comps.filter((c) => c.market_id === m.id).map((c) => c.category)])];
  const seededAudit = idx.forEntity('market', m.id).filter((v) => AUDIT_PREFIXES.some((p) => v.field.startsWith(p)));
  const mc = comps.filter((c) => c.market_id === m.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/audit/new?market=${m.id}`} variant="primary">Log a shelf observation</ButtonLink>
      </div>

      {seededAudit.length ? (
        <Card>
          <CardTitle>Audit summary (from earlier field analysis)</CardTitle>
          <ValueTable values={seededAudit} idx={idx} />
        </Card>
      ) : null}

      {categories.length === 0 && !seededAudit.length ? <Empty title="No audits or competitor cards yet">Start with a store audit across outlet tiers.</Empty> : null}

      {categories.map((cat) => {
        const o = obs.filter((x) => x.category === cat) as unknown as Observation[];
        const s = auditSummary(o, m.currency, { clusterWidthPct: width });
        const ourSizes: SizeRef[] = skus
          .filter((k) => families.find((f) => f.id === k.family_id)?.category === cat)
          .map((k) => ({ size: Number((k.variant_attrs as Record<string, unknown>).size_ml ?? 0), unit: 'ml', who: k.sku_code }))
          .filter((x) => x.size > 0);
        const rivalSizes: SizeRef[] = [
          ...mc.filter((c) => c.category === cat).flatMap((c) => c.pack_sizes.map((p) => ({ ...parseSize(p), who: c.brand }))),
          ...o.map((x) => ({ size: x.pack_size, unit: x.pack_unit, who: x.brand })),
        ].filter((x): x is SizeRef => typeof x.size === 'number' && typeof x.unit === 'string');
        const gaps = rangeGaps(ourSizes, rivalSizes);
        return (
          <section key={cat} className="space-y-4">
            <h2 className="text-base font-semibold capitalize">{cat}</h2>
            {s ? (
              <Card>
                <CardTitle>Shelf prices per {s.base} — <Num t={s.n} /> SKUs observed</CardTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Lowest</p><Num t={s.priceLow} /></div>
                  <div><p className="text-xs text-muted-foreground">Median</p><Num t={s.priceMedian} /></div>
                  <div><p className="text-xs text-muted-foreground">Highest</p><Num t={s.priceHigh} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">Mainstream cluster</p>
                    <span className="flex flex-wrap items-baseline gap-1"><Num t={s.clusterLow} bare /> – <Num t={s.clusterHigh} /></span>
                  </div>
                </div>
                <form className="mt-3 flex flex-wrap items-end gap-2" method="get">
                  <Field label="Cluster window (± %)"><Input name="w" type="number" min={2} max={50} step="0.5" defaultValue={width} className="w-28" /></Field>
                  <Button type="submit" variant="secondary">Recalculate</Button>
                </form>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Price bands</p>
                    <ul className="space-y-1 text-sm">
                      {s.bands.map((b) => (
                        <li key={b.band} className="flex justify-between capitalize"><span>{b.band}</span><Num t={b.share} /></li>
                      ))}
                    </ul>
                    {s.localShare ? <p className="mt-2 flex justify-between text-sm"><span>Local share</span><Num t={s.localShare} /></p> : null}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Attributes</p>
                    <ul className="space-y-1 text-sm">
                      {s.attributeShares.map((a) => (
                        <li key={`${a.attribute}:${a.option}`} className="flex justify-between gap-2"><span>{a.attribute}: {a.option}</span><Num t={a.share} /></li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-muted-foreground uppercase">Shelf share by facings</p>
                    <ul className="space-y-1 text-sm">
                      {s.facingShares.slice(0, 6).map((f) => (
                        <li key={f.brand} className="flex justify-between gap-2"><span>{f.brand}</span><Num t={f.share} /></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ) : null}

            <Card>
              <CardTitle>Range-gap check</CardTitle>
              {ourSizes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No principal SKUs in this category yet.</p>
              ) : gaps.length ? (
                <>
                  <p className="mb-2 text-sm text-muted-foreground">
                    Rival pack sizes with no SKU of ours within ±15% (ours: {ourSizes.map((x) => x.who).join(', ')}):
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {gaps.map((g) => (
                      <li key={g.size}><Badge tone="warn">{g.size} — {g.offeredBy.join(', ')}</Badge></li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-ok">Our range covers every rival pack size observed.</p>
              )}
            </Card>
          </section>
        );
      })}

      <Card>
        <CardTitle>Competitor cards</CardTitle>
        {mc.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {mc.map((c) => (
              <li key={c.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-semibold">{c.brand} <span className="font-normal text-muted-foreground">· {c.owner}</span></p>
                {c.pack_sizes.length ? <p className="text-xs text-muted-foreground">SKUs: {c.pack_sizes.join(', ')}</p> : null}
                <dl className="mt-2 space-y-1">
                  <div><dt className="inline text-muted-foreground">Positioning: </dt><dd className="inline">{c.positioning}</dd></div>
                  <div><dt className="inline text-muted-foreground">Strength: </dt><dd className="inline">{c.structural_strength}</dd></div>
                  <div><dt className="inline text-muted-foreground">Weakness: </dt><dd className="inline">{c.weakness}</dd></div>
                  <div className="rounded bg-ok-bg px-2 py-1 text-ok"><dt className="inline font-medium">How we win: </dt><dd className="inline">{c.how_we_win}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No competitor cards yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Write a competitor card">
            <form action={addCompetitor} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="market_id" value={m.id} />
              <Field label="Category"><Input name="category" defaultValue="dishwashing" required /></Field>
              <Field label="Brand"><Input name="brand" required /></Field>
              <Field label="Owner"><Input name="owner" /></Field>
              <Field label="Pack sizes (comma-separated)"><Input name="pack_sizes" placeholder="500ml, 1L, 3.5kg" /></Field>
              <Field label="Positioning" className="sm:col-span-2"><Input name="positioning" /></Field>
              <Field label="Structural strength"><Input name="structural_strength" /></Field>
              <Field label="Weakness"><Input name="weakness" /></Field>
              <Field label="How we win (required)" className="sm:col-span-2"><Textarea name="how_we_win" required minLength={3} /></Field>
              <div className="sm:col-span-2"><Button type="submit">Save card</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>

      {obs.length ? (
        <Card>
          <CardTitle>Recent observations</CardTitle>
          <ul className="divide-y divide-border">
            {obs.slice(0, 25).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  {o.brand} {o.pack_size}{o.pack_unit}
                  <span className="block text-xs text-muted-foreground">
                    {o.outlet_name ?? 'outlet'} {o.outlet_tier ? `(${o.outlet_tier})` : ''} · {o.observed_on}
                    {o.photo_path ? <> · <Link className="underline" href={fileUrl(o.photo_path)} target="_blank">photo</Link></> : null}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Num t={leaf('price_per_litre', pricePerBase(o as unknown as Observation), `${o.currency}/${['g', 'kg'].includes(o.pack_unit) ? 'kg' : 'L'}`, { tag: 'measured', label: `${o.brand} price per ${['g', 'kg'].includes(o.pack_unit) ? 'kg' : 'L'}`, source: { label: `Store audit ${o.outlet_name ?? ''}`.trim(), asOf: o.observed_on } })} />
                  <form action={deleteObservation}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="min-h-11 min-w-11 text-muted-foreground" aria-label="Delete observation">✕</button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
