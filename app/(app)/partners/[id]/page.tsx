import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, ButtonLink, Card, CardTitle, Empty, Field, Input, PageHeader, Select, Textarea } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { DEAL_STAGES } from '@/components/partner-list';
import { byId, rows } from '@/lib/db/data';
import { assessAsks, metricLabel } from '@/lib/db/partners';
import { addAsk, addDocument, updatePartner } from '@/app/actions/partners';
import { fileUrl } from '@/lib/storage';

export const metadata = { title: 'Partner' };

export default async function PartnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await byId('partners', id);
  if (!p) notFound();
  const [asks, benchmarks, roles, markets, docs, principals] = await Promise.all([rows('partner_asks'), rows('terms_benchmarks'), rows('partner_roles'), rows('markets'), rows('documents'), rows('principals')]);
  const market = markets.find((m) => m.id === p.market_id);
  const assessed = assessAsks(p, asks, benchmarks);
  const myDocs = docs.filter((d) => d.entity_type === 'partner' && d.entity_id === p.id);
  return (
    <div className="space-y-4">
      <PageHeader back={{ href: '/partners', label: 'Partners' }} title={p.name} subtitle={`${market?.name ?? 'Any market'} · ${p.roles.map((r) => roles.find((x) => x.role === r)?.label ?? r).join(', ')}`} actions={<Badge>{p.deal_stage.replace('_', ' ')}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Terms asked vs benchmark</CardTitle>
          {assessed.length ? (
            <ul className="space-y-2">
              {assessed.map((a) => (
                <li key={a.ask.id} className={`rounded-lg p-2 text-sm ${a.verdict === 'above' || a.verdict === 'below' ? 'bg-danger-bg text-danger' : 'bg-muted'}`} data-verdict={a.verdict}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{metricLabel(a.ask.metric)}</span>
                    {a.t ? <Num t={a.t} /> : <span>{a.ask.value_text}</span>}
                  </div>
                  {a.benchmark ? (
                    <p className="text-xs">
                      Benchmark {a.range} — {a.benchmark.source}
                      {a.benchmark.market_id ? ` (${markets.find((m) => m.id === a.benchmark!.market_id)?.name})` : ' (any market)'}
                      {a.verdict === 'above' ? ' · above range' : a.verdict === 'below' ? ' · below range' : ' · within range'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No benchmark for this metric.</p>
                  )}
                  {a.ask.note ? <p className="text-xs">{a.ask.note}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No asks recorded" />
          )}
          <div className="mt-3">
            <Disclosure summary="Record an ask">
              <form action={addAsk} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="partner_id" value={p.id} />
                <Field label="Metric">
                  <Select name="metric" defaultValue="gross_margin">
                    {['gross_margin', 'incentive', 'credit_days', 'term_months', 'moq', 'exclusivity_rule', 'review_cadence'].map((m) => <option key={m} value={m}>{metricLabel(m)}</option>)}
                  </Select>
                </Field>
                <Field label="Value"><Input name="value" inputMode="decimal" /></Field>
                <Field label="Unit"><Select name="unit" defaultValue="pct"><option value="pct">%</option><option value="days">days</option><option value="months">months</option><option value="">—</option></Select></Field>
                <Field label="Or text"><Input name="value_text" /></Field>
                <Field label="Asked on"><Input name="asked_on" type="date" /></Field>
                <Field label="Note"><Input name="note" /></Field>
                <div className="sm:col-span-2"><Button type="submit">Save ask</Button></div>
              </form>
            </Disclosure>
          </div>
        </Card>

        <Card>
          <CardTitle>Profile & deal stage</CardTitle>
          <form action={updatePartner} className="grid gap-3">
            <input type="hidden" name="id" value={p.id} />
            <Field label="Deal stage"><Select name="deal_stage" defaultValue={p.deal_stage}>{DEAL_STAGES.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}</Select></Field>
            <Field label="Score (0–100)"><Input name="score" type="number" min={0} max={100} defaultValue={p.score ?? ''} /></Field>
            <Field label="Reach"><Textarea name="reach" defaultValue={p.reach ?? ''} /></Field>
            <Field label="Competing lines"><Input name="competing_lines" defaultValue={p.competing_lines ?? ''} /></Field>
            <Field label="Contact"><Input name="contact" defaultValue={p.contact ?? ''} /></Field>
            <Field label="Notes"><Textarea name="notes" defaultValue={p.notes ?? ''} /></Field>
            <Button type="submit" variant="secondary">Save</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Documents</CardTitle>
          {myDocs.length ? (
            <ul className="space-y-1 text-sm">
              {myDocs.map((d) => <li key={d.id}><Link className="underline" href={fileUrl(d.path)} target="_blank">{d.name}</Link> <span className="text-xs text-muted-foreground">{d.kind} · {d.uploaded_at.slice(0, 10)}</span></li>)}
            </ul>
          ) : (
            <Empty title="No documents" />
          )}
          <form action={addDocument} className="mt-3 grid gap-2">
            <input type="hidden" name="entity_type" value="partner" />
            <input type="hidden" name="entity_id" value={p.id} />
            <Field label="Kind"><Select name="kind" defaultValue="quote"><option value="quote">Quote</option><option value="contract">Contract</option><option value="certificate">Certificate</option><option value="other">Other</option></Select></Field>
            <input type="file" name="file" required className="text-sm" />
            <Button type="submit" variant="secondary">Upload</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Proposal</CardTitle>
          <p className="mb-2 text-sm text-muted-foreground">Exports a partner-role proposal filled from the brand story, market evidence, role template and benchmark terms.</p>
          <div className="flex flex-wrap gap-2">
            {p.roles.map((r) => (
              <ButtonLink key={r} href={`/proposal?market=${p.market_id ?? ''}&principal=${principals[0]?.id ?? ''}&role=${r}&partner=${p.id}`}>
                {roles.find((x) => x.role === r)?.label ?? r} proposal
              </ButtonLink>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
