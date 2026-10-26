import Link from 'next/link';
import { Badge, Button, Card, Field, Input, PageHeader, Select } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { rows } from '@/lib/db/data';
import { scoreFor } from '@/lib/db/markets';
import { buildAllPlays } from '@/lib/db/plays';
import { count } from '@/lib/calc/traced';
import { createMarket } from '@/app/actions/markets';

export const metadata = { title: 'Markets' };

const STATUS_TONE = { active: 'ok', exploring: 'info', paused: 'warn' } as const;

export default async function MarketsPage() {
  const [markets, plays] = await Promise.all([rows('markets'), buildAllPlays()]);
  const scored = await Promise.all(markets.map(async (m) => ({ m, score: await scoreFor(m) })));
  scored.sort((a, b) => b.score.value - a.score.value);
  return (
    <div className="space-y-4">
      <PageHeader title="Markets" subtitle="Ranked by attractiveness score. Markets can be added at any time — there is no fixed order." />
      <ul className="grid gap-3 md:grid-cols-2">
        {scored.map(({ m, score }) => {
          const mp = plays.filter((p) => p.market.id === m.id);
          return (
            <li key={m.id}>
              <Card className="h-full">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/markets/${m.id}`} className="text-base font-semibold hover:underline">
                      {m.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {m.iso2} · {m.currency} · {m.vat_name ?? 'tax n/a'}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                </div>
                {m.blocker ? <p className="mt-2 rounded-lg bg-warn-bg px-2 py-1 text-xs text-warn">Blocker: {m.blocker}</p> : null}
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Attractiveness</p>
                    <Num t={score} size="lg" />
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Plays</p>
                    <Num t={count('plays_in_market', mp.length, 'Plays', `Plays modelled in ${m.name}.`)} />
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Disclosure summary="Add a market">
        <form action={createMarket} className="grid gap-3 sm:grid-cols-3">
          <Field label="Name"><Input name="name" required placeholder="Thailand" /></Field>
          <Field label="ISO code"><Input name="iso2" required maxLength={2} placeholder="TH" /></Field>
          <Field label="Currency"><Input name="currency" required maxLength={3} placeholder="THB" /></Field>
          <Field label="Sales tax name"><Input name="vat_name" placeholder="VAT" /></Field>
          <Field label="Status">
            <Select name="status" defaultValue="exploring">
              <option value="exploring">Exploring</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Lat"><Input name="lat" inputMode="decimal" /></Field>
            <Field label="Lng"><Input name="lng" inputMode="decimal" /></Field>
          </div>
          <div className="sm:col-span-3"><Button type="submit">Create market</Button></div>
        </form>
      </Disclosure>
    </div>
  );
}
