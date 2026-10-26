import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, KV, Notice, Select, Textarea } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num, TextValue } from '@/components/num';
import { byId, rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { marketFactors, scoreFor, scoreWeights } from '@/lib/db/markets';
import { buildAllPlays, playTitle } from '@/lib/db/plays';
import { SCORE_FACTORS } from '@/lib/calc/score';
import { addEvidence, addValue, updateMarket } from '@/app/actions/markets';
import { currentStage } from '@/lib/stages';
import { STAGE_NAMES } from '@/lib/stages';

export default async function MarketOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, score, { factors, auto }, weights, plays, evidence, trackers, items, overrides, principals, notes] = await Promise.all([
    valueIndex(), scoreFor(m), marketFactors(m), scoreWeights(), buildAllPlays(), rows('market_evidence'), rows('stage_trackers'),
    rows('stage_items'), rows('gate_overrides'), rows('principals'), rows('market_watch_notes'),
  ]);
  const values = idx.forEntity('market', m.id);
  const keyFigures = values.filter((v) => !v.field.startsWith('score_') && v.tag !== 'placeholder').slice(0, 10);
  const mp = plays.filter((p) => p.market.id === m.id);
  const ev = evidence.filter((e) => e.market_id === m.id);
  const tr = trackers.filter((t) => t.market_id === m.id);
  const mnotes = notes.filter((n) => n.market_id === m.id).slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle>Attractiveness scorecard</CardTitle>
        <div className="mb-3 flex items-baseline gap-3">
          <Num t={score} size="xl" />
          <span className="text-xs text-muted-foreground">Weights editable in <Link className="underline" href="/settings">Settings</Link></span>
        </div>
        <dl>
          {SCORE_FACTORS.map((f) => (
            <KV
              key={f.key}
              label={
                <span>
                  {f.label} <span className="text-xs">(<Num t={weights[f.key]} />)</span>
                  {auto[f.key] ? <span className="block text-xs">auto from population</span> : null}
                </span>
              }
            >
              {factors[f.key] ? <Num t={factors[f.key]!} /> : <span className="text-xs text-muted-foreground">not scored</span>}
            </KV>
          ))}
        </dl>
        <Disclosure summary="Score a factor">
          <form action={addValue} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="entity_type" value="market" />
            <input type="hidden" name="entity_id" value={m.id} />
            <input type="hidden" name="unit" value="score" />
            <Field label="Factor">
              <Select name="field" required>
                {SCORE_FACTORS.map((f) => (
                  <option key={f.key} value={`score_${f.key}`}>{f.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Score 0–100"><Input name="value_num" type="number" min={0} max={100} required /></Field>
            <Field label="Tag"><TagSelect defaultValue="estimated" /></Field>
            <Field label="Why (note)"><Input name="note" required placeholder="e.g. NSK open to talks; WRT not needed" /></Field>
            <div className="sm:col-span-2"><Button type="submit">Save score</Button></div>
          </form>
        </Disclosure>
      </Card>

      <Card>
        <CardTitle>Status</CardTitle>
        {m.status === 'paused' ? <Notice tone="warn">Paused — progress is kept. Blocker: {m.blocker ?? 'not recorded'}</Notice> : null}
        {m.alt_routes.length ? (
          <div className="mt-2 text-sm">
            <p className="font-medium">Alternative routes</p>
            <ul className="list-disc pl-5 text-muted-foreground">{m.alt_routes.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        ) : null}
        <form action={updateMarket} className="mt-3 grid gap-3">
          <input type="hidden" name="id" value={m.id} />
          <Field label="Status">
            <Select name="status" defaultValue={m.status}>
              <option value="active">Active</option>
              <option value="exploring">Exploring</option>
              <option value="paused">Paused</option>
            </Select>
          </Field>
          <Field label="Blocker"><Input name="blocker" defaultValue={m.blocker ?? ''} /></Field>
          <Field label="Alternative routes (comma-separated)"><Textarea name="alt_routes" defaultValue={m.alt_routes.join(', ')} /></Field>
          <Button type="submit" variant="secondary">Update status</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Key figures</CardTitle>
        {keyFigures.length ? (
          <dl>
            {keyFigures.map((v) => (
              <KV key={v.id} label={v.label ?? v.field}>
                {v.value_num != null ? <Num t={tracedFromValue(v, idx)} /> : <TextValue t={tracedFromValue(v, idx)} text={v.value_text ?? 'empty'} />}
              </KV>
            ))}
          </dl>
        ) : (
          <Empty title="No figures yet">Add them on the Data tab.</Empty>
        )}
        <Link href={`/markets/${m.id}/data`} className="mt-2 inline-flex min-h-11 items-center text-sm text-primary">All figures and history →</Link>
      </Card>

      <Card>
        <CardTitle>Plays in {m.name}</CardTitle>
        {mp.length ? (
          <ul className="divide-y divide-border">
            {mp.map((p) => (
              <li key={p.play.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/plays/${p.play.id}`} className="min-w-0 text-sm hover:underline">{playTitle(p)}</Link>
                <Num t={p.econ.C} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No plays yet"><Link className="underline" href={`/plays/new?market=${m.id}`}>Create one</Link></Empty>
        )}
      </Card>

      <Card>
        <CardTitle>Entry trackers</CardTitle>
        {tr.length ? (
          <ul className="space-y-2">
            {tr.map((t) => {
              const st = currentStage(items.filter((i) => i.tracker_id === t.id), overrides.filter((o) => o.tracker_id === t.id));
              return (
                <li key={t.id}>
                  <Link href={`/markets/${m.id}/stages?tracker=${t.id}`} className="flex min-h-11 items-center justify-between rounded-lg border border-border px-3 hover:border-primary">
                    <span className="text-sm">{principals.find((p) => p.id === t.principal_id)?.name}{t.scope ? ` · ${t.scope}` : ''}</span>
                    <Badge tone={st > 7 ? 'ok' : 'info'}>{st > 7 ? 'All gates passed' : `Stage ${st} · ${STAGE_NAMES[st]}`}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No tracker yet"><Link className="underline" href={`/markets/${m.id}/stages`}>Start one</Link></Empty>
        )}
      </Card>

      <Card>
        <CardTitle>Demand case (market evidence)</CardTitle>
        {ev.length ? (
          <ul className="space-y-2 text-sm">
            {ev.map((e) => (
              <li key={e.id}>
                {e.statement}
                <span className="block text-xs text-muted-foreground">
                  <span className="tag-dot mr-1" data-tag={e.tag} aria-hidden="true" />
                  {e.source_url ? <a className="underline" href={e.source_url} target="_blank" rel="noreferrer">{e.source}</a> : e.source}
                  {e.as_of ? ` · ${e.as_of}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No evidence yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Add evidence">
            <form action={addEvidence} className="grid gap-3">
              <input type="hidden" name="market_id" value={m.id} />
              <Field label="Statement"><Textarea name="statement" required /></Field>
              <Field label="Headline value"><Input name="value" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Tag"><TagSelect defaultValue="public" /></Field>
                <Field label="As of"><Input name="as_of" type="date" /></Field>
              </div>
              <Field label="Source"><Input name="source" /></Field>
              <Field label="Link"><Input name="source_url" type="url" /></Field>
              <Button type="submit">Add</Button>
            </form>
          </Disclosure>
        </div>
      </Card>

      {mnotes.length ? (
        <Card className="lg:col-span-2">
          <CardTitle>Latest market watch</CardTitle>
          <ul className="space-y-2 text-sm">
            {mnotes.map((n) => (
              <li key={n.id}>
                <span className="font-medium">{n.headline}</span>
                {n.impact ? <span className="block text-muted-foreground">{n.impact}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
