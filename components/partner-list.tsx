import Link from 'next/link';
import { Badge, Button, Empty, Field, Input, Select, Textarea } from './ui';
import { Disclosure } from './forms';
import { Num } from './num';
import { addPartner } from '@/app/actions/partners';
import { assessAsks, metricLabel } from '@/lib/db/partners';
import type { Market, Partner, PartnerAsk, PartnerRole, TermsBenchmark } from '@/lib/db/types';

export const DEAL_STAGES = ['identified', 'in_contact', 'terms_received', 'negotiating', 'signed', 'dropped'];

export function PartnerList({ partners, asks, benchmarks, roles, markets }: { partners: Partner[]; asks: PartnerAsk[]; benchmarks: TermsBenchmark[]; roles: PartnerRole[]; markets: Market[] }) {
  if (!partners.length) return <Empty title="No partners yet" />;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {partners.map((p) => {
        const assessed = assessAsks(p, asks, benchmarks);
        const red = assessed.filter((a) => a.verdict === 'above' || a.verdict === 'below');
        return (
          <li key={p.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-2">
              <Link href={`/partners/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
              <Badge>{p.deal_stage.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {markets.find((m) => m.id === p.market_id)?.name ?? 'Any market'} · {p.roles.map((r) => roles.find((x) => x.role === r)?.label ?? r).join(', ')}
            </p>
            {p.reach ? <p className="mt-1 text-sm">{p.reach}</p> : null}
            {assessed.length ? (
              <ul className="mt-2 space-y-1">
                {assessed.map((a) => (
                  <li key={a.ask.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-1 text-sm ${a.verdict === 'above' || a.verdict === 'below' ? 'bg-danger-bg text-danger' : 'bg-muted'}`} data-verdict={a.verdict}>
                    <span>{metricLabel(a.ask.metric)}</span>
                    <span className="flex items-center gap-2">
                      {a.t ? <Num t={a.t} /> : <span>{a.ask.value_text}</span>}
                      {a.range ? <span className="text-xs">vs {a.range}</span> : null}
                      {a.verdict === 'above' ? <Badge tone="danger">Above benchmark</Badge> : a.verdict === 'below' ? <Badge tone="danger">Below benchmark</Badge> : a.verdict === 'within' ? <Badge tone="ok">Within</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {red.length ? <p className="mt-1 text-xs text-danger">Benchmark: {red.map((r) => r.benchmark?.source).join(', ')}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AddPartnerForm({ marketId, markets, roles }: { marketId?: string; markets: Market[]; roles: PartnerRole[] }) {
  return (
    <Disclosure summary="Add a partner">
      <form action={addPartner} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="go" value="detail" />
        <Field label="Name"><Input name="name" required /></Field>
        <Field label="Market">
          <Select name="market_id" defaultValue={marketId ?? ''}>
            <option value="">Any market</option>
            {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-xs font-medium text-muted-foreground">Roles</legend>
          <div className="mt-1 flex flex-wrap gap-3">
            {roles.filter((r) => r.role !== 'own_entry').map((r) => (
              <label key={r.role} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="roles" value={r.role} className="size-5" />{r.label}</label>
            ))}
          </div>
        </fieldset>
        <Field label="Reach" className="sm:col-span-2"><Input name="reach" /></Field>
        <Field label="Competing lines"><Input name="competing_lines" /></Field>
        <Field label="Contact"><Input name="contact" /></Field>
        <Field label="Deal stage">
          <Select name="deal_stage" defaultValue="identified">{DEAL_STAGES.map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}</Select>
        </Field>
        <Field label="Score (0–100)"><Input name="score" type="number" min={0} max={100} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" /></Field>
        <div className="sm:col-span-2"><Button type="submit">Add partner</Button></div>
      </form>
    </Disclosure>
  );
}
