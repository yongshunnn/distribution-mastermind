import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, Field, Input, Notice } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { byId, rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { sum } from '@/lib/calc/traced';
import { addValue } from '@/app/actions/markets';

export const metadata = { title: 'Entry routes' };

const OWN_ONE_OFF = [
  ['own_entry_entity_cost', 'Entity set-up'],
  ['own_entry_licence_cost', 'Licences (e.g. WRT)'],
  ['own_entry_paid_up_capital', 'Paid-up capital locked'],
] as const;
const OWN_MONTHLY = [
  ['own_entry_staff_monthly', 'Staff'],
  ['own_entry_warehouse_monthly', 'Warehouse / 3PL'],
  ['own_entry_admin_monthly', 'Admin, accounting, rent'],
] as const;

export default async function RoutesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, roles, partners, plays] = await Promise.all([valueIndex(), rows('partner_roles'), rows('partners'), rows('plays')]);
  const mp = partners.filter((p) => p.market_id === m.id);
  const oneOff = OWN_ONE_OFF.map(([f]) => idx.get('market', m.id, f)).filter((v) => v !== undefined).map((v) => tracedFromValue(v, idx));
  const monthly = OWN_MONTHLY.map(([f]) => idx.get('market', m.id, f)).filter((v) => v !== undefined).map((v) => tracedFromValue(v, idx));
  const usedRoutes = new Set(plays.filter((p) => p.market_id === m.id).map((p) => p.route_type));

  return (
    <div className="space-y-4">
      {m.status === 'paused' && m.alt_routes.length ? (
        <Notice tone="warn">
          Paused ({m.blocker}). Alternative routes: {m.alt_routes.join('; ')}.
        </Notice>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => {
          const candidates = mp.filter((p) => p.roles.includes(r.role));
          return (
            <li key={r.role}>
              <Card className="h-full">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold">{r.label}</h3>
                  <span className="flex gap-1">
                    {usedRoutes.has(r.role) ? <Badge tone="info">used by a play</Badge> : null}
                    {r.role !== 'own_entry' ? (
                      <Badge tone={candidates.length >= 2 ? 'ok' : candidates.length ? 'warn' : 'neutral'}>
                        {candidates.length >= 2 ? '≥2 candidates' : candidates.length ? 'only one candidate' : 'no candidates'}
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <dl className="space-y-1 text-sm">
                  <div><dt className="inline text-muted-foreground">Partner brings: </dt><dd className="inline">{r.what_partner_brings}</dd></div>
                  <div><dt className="inline text-muted-foreground">We bring: </dt><dd className="inline">{r.what_we_bring}</dd></div>
                  <div><dt className="inline text-muted-foreground">Framework: </dt><dd className="inline">{r.commercial_framework}</dd></div>
                  <div><dt className="inline text-muted-foreground">Ask first: </dt><dd className="inline">{r.what_we_ask_first}</dd></div>
                </dl>
                {candidates.length ? (
                  <p className="mt-2 text-sm">
                    Candidates: {candidates.map((c, i) => <span key={c.id}>{i ? ', ' : ''}<Link className="underline" href={`/partners/${c.id}`}>{c.name}</Link></span>)}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <Card>
        <CardTitle>Own full-cycle entry — cost model</CardTitle>
        <p className="mb-3 text-sm text-muted-foreground">Our own entity imports, stores, sells and collects. Enter quotes below; the totals feed the fixed cost of own-entry plays.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">One-off</p>
            {oneOff.length ? <Num t={sum('own_entry_one_off', m.currency, oneOff, { label: 'Own entry — one-off', meaning: 'Entity, licence and locked capital before the first sale.' })} size="lg" /> : <p className="text-sm text-muted-foreground">Not modelled</p>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Monthly fixed</p>
            {monthly.length ? <Num t={sum('own_entry_monthly', `${m.currency}/month`, monthly, { label: 'Own entry — monthly fixed', meaning: 'Staff, warehouse and admin per month.' })} size="lg" /> : <p className="text-sm text-muted-foreground">Not modelled</p>}
          </div>
        </div>
        <div className="mt-3">
          <Disclosure summary="Enter an own-entry cost">
            <form action={addValue} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="entity_type" value="market" />
              <input type="hidden" name="entity_id" value={m.id} />
              <Field label="Cost line">
                <select name="field" className="min-h-11 w-full rounded-lg border border-border bg-card px-3 text-base sm:text-sm">
                  {OWN_ONE_OFF.map(([f, l]) => <option key={f} value={f}>{l} (one-off)</option>)}
                  {OWN_MONTHLY.map(([f, l]) => <option key={f} value={f}>{l} (monthly)</option>)}
                </select>
              </Field>
              <Field label={`Amount (${m.currency})`}><Input name="value_num" inputMode="decimal" required /></Field>
              <Field label="Unit" hint="Currency for one-off; currency/month for monthly"><Input name="unit" defaultValue={m.currency} /></Field>
              <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
              <Field label="Source" className="sm:col-span-2"><Input name="source_label" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Save</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>
    </div>
  );
}
