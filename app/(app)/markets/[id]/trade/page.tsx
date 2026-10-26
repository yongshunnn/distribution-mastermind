import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, Empty, Field, Input, Select, Textarea } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num, TextValue } from '@/components/num';
import { byId, rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { addGate, addTradeRule, updateGateStatus } from '@/app/actions/markets';
import { TAG_LABEL } from '@/lib/calc/traced';

export const metadata = { title: 'Trade & compliance' };

const TAX_FIELDS = ['import_tax_rate', 'import_tax_recoverable', 'sales_tax_rate', 'gst_rate', 'duty_tax_basis', 'import_permit'];
const GATE_STATUS = ['open', 'in_progress', 'done', 'not_needed', 'blocked'];

export default async function TradeTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, rules, gates, families] = await Promise.all([valueIndex(), rows('trade_rules'), rows('compliance_gates'), rows('product_families')]);
  const mr = rules.filter((r) => r.dest_iso2 === m.iso2);
  const mg = gates.filter((g) => g.market_id === m.id);
  const tax = TAX_FIELDS.map((f) => idx.get('market', m.id, f)).filter((v) => v !== undefined);

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Tax at import and on shelf</CardTitle>
        <ul className="divide-y divide-border">
          {tax.map((v) => (
            <li key={v.id} className="flex flex-wrap items-start justify-between gap-2 py-2">
              <span className="text-sm">{v.label}</span>
              {v.value_num != null ? <Num t={tracedFromValue(v, idx)} /> : <TextValue t={tracedFromValue(v, idx)} text={v.value_text ?? 'empty'} />}
            </li>
          ))}
        </ul>
        {!tax.length ? <Empty title="No tax settings yet">Add import_tax_rate, import_tax_recoverable and sales_tax_rate on the Data tab.</Empty> : null}
      </Card>

      <Card>
        <CardTitle>Duty rules (HS × origin × regime)</CardTitle>
        <p className="mb-2 text-xs text-muted-foreground">
          Plays use a preferential rate only when the play records the matching certificate of origin; otherwise MFN applies.
        </p>
        {mr.length ? (
          <ul className="divide-y divide-border">
            {mr.map((r) => {
              const d = idx.get('trade_rule', r.id, 'duty_pct');
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    HS {r.hs_code} · {r.regime}
                    <span className="block text-xs text-muted-foreground">
                      Origin {r.origin_iso2 ?? 'any'} → {r.dest_iso2}
                      {r.coo_form ? ` · needs ${r.coo_form}` : ''}
                    </span>
                  </span>
                  {d ? <Num t={tracedFromValue(d, idx)} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty title="No duty rules yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Add a duty rule">
            <form action={addTradeRule} className="grid gap-3 sm:grid-cols-3">
              <input type="hidden" name="dest_iso2" value={m.iso2} />
              <Field label="HS code"><Input name="hs_code" required placeholder="3402.90" /></Field>
              <Field label="Origin ISO (blank = any)"><Input name="origin_iso2" maxLength={2} /></Field>
              <Field label="Regime"><Input name="regime" required placeholder="MFN / ATIGA / RCEP" /></Field>
              <Field label="CoO form"><Input name="coo_form" placeholder="Form D" /></Field>
              <Field label="Duty %"><Input name="duty_pct" inputMode="decimal" required /></Field>
              <Field label="Tag"><TagSelect /></Field>
              <Field label="Source" className="sm:col-span-2"><Input name="source" /></Field>
              <Field label="Link"><Input name="source_url" type="url" /></Field>
              <div className="sm:col-span-3"><Button type="submit">Add rule</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>

      <Card>
        <CardTitle>Compliance gates</CardTitle>
        {mg.length ? (
          <ul className="space-y-3">
            {mg.map((g) => (
              <li key={g.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{g.requirement}</p>
                    {g.detail ? <p className="text-sm text-muted-foreground">{g.detail}</p> : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="tag-dot mr-1" data-tag={g.tag} aria-hidden="true" />
                      {TAG_LABEL[g.tag]}
                      {g.authority ? ` · ${g.authority}` : ''}
                      {g.source ? ' · ' : ''}
                      {g.source_url ? <a className="underline" href={g.source_url} target="_blank" rel="noreferrer">{g.source}</a> : g.source}
                      {g.product_family_id ? ` · ${families.find((f) => f.id === g.product_family_id)?.name}` : ''}
                    </p>
                  </div>
                  <form action={updateGateStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={g.id} />
                    <Select name="status" defaultValue={g.status} aria-label="Gate status" className="w-36">
                      {GATE_STATUS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </Select>
                    <Button type="submit" variant="secondary">Set</Button>
                  </form>
                </div>
                {g.status === 'blocked' ? <Badge tone="danger" className="mt-2">Blocked</Badge> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No gates yet" />
        )}
        <div className="mt-3">
          <Disclosure summary="Add a gate">
            <form action={addGate} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="market_id" value={m.id} />
              <Field label="Requirement"><Input name="requirement" required /></Field>
              <Field label="Authority"><Input name="authority" /></Field>
              <Field label="Detail" className="sm:col-span-2"><Textarea name="detail" /></Field>
              <Field label="Product family (optional)">
                <Select name="product_family_id" defaultValue="">
                  <option value="">All products</option>
                  {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Field>
              <Field label="Deadline"><Input name="deadline" type="date" /></Field>
              <Field label="Tag"><TagSelect /></Field>
              <Field label="Source"><Input name="source" /></Field>
              <Field label="Link" className="sm:col-span-2"><Input name="source_url" type="url" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Add gate</Button></div>
            </form>
          </Disclosure>
        </div>
      </Card>
    </div>
  );
}
