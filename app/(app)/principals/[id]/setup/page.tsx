import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Button, ButtonLink, Card, CardTitle, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import { Disclosure, TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { ValueTable } from '@/components/value-table';
import { SkuImport } from '@/components/sku-import';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { missingFields, principalSetup } from '@/lib/db/principals';
import { leaf } from '@/lib/calc/traced';
import { addFeeTerm, saveCost, saveDistribution, saveSite, saveStep1, saveSupplierPrice } from '@/app/actions/principals';
import { SalesImport } from './sales-import';

export const metadata = { title: 'Setup wizard' };

const STEPS = ['Principal & brand', 'Production', 'Products & configurations', 'Current distribution', 'Sales numbers', 'Costs'];
const COSTS = [
  ['freight_per_unit', 'Main freight per unit'], ['origin_handling_per_unit', 'Origin handling per unit'], ['clearance_per_unit', 'Clearance per unit'],
  ['insurance_per_unit', 'Insurance per unit'], ['pallet_cost_per_day', 'Warehouse / 3PL pallet per day'], ['handling_per_order', 'Pick & pack per order'],
  ['delivery_cost_per_drop', 'Delivery per drop'], ['marketing_per_unit', 'Marketing per unit'], ['fixed_monthly_cost', 'Fixed monthly cost per channel'], ['stock_days', 'Stock days'],
] as const;

export default async function SetupWizard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ step?: string }> }) {
  const { id } = await params;
  const step = Math.min(6, Math.max(1, Number((await searchParams).step ?? 1)));
  const setup = await principalSetup(id);
  if (!setup) notFound();
  const [markets, channels, prices, idx] = await Promise.all([rows('markets'), rows('channels'), rows('sku_prices'), valueIndex()]);
  const missing = missingFields(setup);
  const p = setup.principal;
  const brand = setup.brands[0];

  return (
    <div className="space-y-4">
      <nav aria-label="Wizard steps" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((s, i) => (
            <li key={s}>
              <Link href={`?step=${i + 1}`} aria-current={step === i + 1 ? 'step' : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm ${step === i + 1 ? 'border-primary bg-accent font-medium' : 'border-border'}`}>
                {i + 1}. {s} {missing[i + 1].length ? <span className="size-2 rounded-full bg-[var(--tag-estimated)]" aria-label="has missing fields" /> : <span className="text-ok" aria-label="complete">✓</span>}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {missing[step].length ? <Notice tone="warn">Missing (allowed, but flagged): {missing[step].join(', ')}</Notice> : <Notice tone="ok">This step has everything the models need.</Notice>}

      {step === 1 ? (
        <Card>
          <CardTitle>1 · Principal and brand</CardTitle>
          <form action={saveStep1} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={p.id} />
            {brand ? <input type="hidden" name="brand_id" value={brand.id} /> : null}
            <Field label="Company"><Input name="name" defaultValue={p.name} required /></Field>
            <Field label="Country (ISO)"><Input name="country" defaultValue={p.country ?? ''} maxLength={2} /></Field>
            <Field label="Contact" className="sm:col-span-2"><Input name="contact" defaultValue={p.contact ?? ''} /></Field>
            <Field label="Contract type">
              <Select name="contract_type" defaultValue={p.contract_type ?? ''}>
                <option value="">To confirm</option>
                <option value="exclusive_distribution">Exclusive distribution</option>
                <option value="agency">Agency</option>
                <option value="trade_services">Trade services</option>
              </Select>
            </Field>
            <Field label="Territories (ISO, comma-separated)"><Input name="territories" defaultValue={p.territories.join(', ')} /></Field>
            <Field label="Exclusivity" className="sm:col-span-2"><Input name="exclusivity" defaultValue={p.exclusivity ?? ''} placeholder="Only against a minimum purchase commitment" /></Field>
            <Field label="Brand name"><Input name="brand_name" defaultValue={brand?.name ?? ''} /></Field>
            <Field label="Origin claim"><Input name="origin_claim" defaultValue={brand?.origin_claim ?? ''} /></Field>
            <Field label="Brand story (used in proposals)" className="sm:col-span-2"><Textarea name="story" defaultValue={brand?.story ?? ''} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea name="notes" defaultValue={p.notes ?? ''} /></Field>
            <div className="sm:col-span-2"><Button type="submit">Save step 1</Button></div>
          </form>
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium">Fee model ({setup.fees.length ? 'mixed models are summed' : 'none yet'})</p>
            <ul className="space-y-1 text-sm">
              {setup.fees.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2"><span className="capitalize">{f.model.replace('_', ' ')} · {f.basis}</span>{f.amount ? <Num t={tracedFromValue(f.amount, idx)} /> : null}</li>
              ))}
            </ul>
            <FeeTermForm principalId={p.id} />
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          {setup.sites.map((s) => (
            <Card key={s.id}>
              <CardTitle>{s.name}</CardTitle>
              <SiteForm principalId={p.id} site={s} />
            </Card>
          ))}
          <Disclosure summary="Add a production site" open={!setup.sites.length}>
            <SiteForm principalId={p.id} />
          </Disclosure>
          <Card>
            <CardTitle>EXW / FOB price per SKU</CardTitle>
            <ul className="divide-y divide-border">
              {setup.skus.map((s) => {
                const pr = prices.find((x) => x.sku_config_id === s.id && (x.price_type === 'supplier_exw' || x.price_type === 'fob') && !x.market_id);
                const v = pr && idx.get('sku_price', pr.id, 'price');
                return (
                  <li key={s.id} className="py-2">
                    <div className="flex items-center justify-between gap-2"><span className="text-sm">{s.sku_code}</span>{v ? <Num t={tracedFromValue(v, idx)} /> : <Badge tone="warn">no price</Badge>}</div>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-2 text-xs text-primary">Set price</summary>
                      <form action={saveSupplierPrice} className="grid gap-2 sm:grid-cols-4">
                        <input type="hidden" name="principal_id" value={p.id} />
                        <input type="hidden" name="sku_config_id" value={s.id} />
                        <Field label="Price"><Input name="price" inputMode="decimal" required /></Field>
                        <Field label="Currency"><Input name="currency" defaultValue={pr?.currency ?? 'SGD'} maxLength={3} /></Field>
                        <Field label="Type"><Select name="price_type" defaultValue="supplier_exw"><option value="supplier_exw">EXW</option><option value="fob">FOB</option></Select></Field>
                        <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
                        <Field label="Source" className="sm:col-span-3"><Input name="source_label" /></Field>
                        <div className="self-end"><Button type="submit" variant="secondary">Save</Button></div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Families and SKU configurations</CardTitle>
            <ul className="space-y-2 text-sm">
              {setup.families.map((f) => (
                <li key={f.id}>
                  <span className="font-medium">{f.name}</span> <span className="text-muted-foreground">· HS {f.hs_code ?? '—'}</span>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {setup.skus.filter((s) => s.family_id === f.id).map((s) => <li key={s.id}><Badge>{s.sku_code}</Badge></li>)}
                  </ul>
                </li>
              ))}
            </ul>
            <ButtonLink href="/catalogue" className="mt-3">Open catalogue (pack levels, attributes)</ButtonLink>
          </Card>
          <Card>
            <CardTitle>Upload the SKU list</CardTitle>
            <SkuImport principalId={p.id} />
          </Card>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>Channel terms for {p.name}</CardTitle>
            {setup.terms.length ? (
              setup.terms.map((t) => (
                <div key={t.id} className="mb-3">
                  <p className="text-sm font-medium">{t.channel}</p>
                  <ValueTable values={t.values} idx={idx} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No principal-specific terms yet — plays use each channel&apos;s general terms.</p>
            )}
          </Card>
          <Card>
            <CardTitle>Add distribution: channel, price and terms</CardTitle>
            <form action={saveDistribution} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="principal_id" value={p.id} />
              <Field label="Channel">
                <Select name="channel_id" required>
                  {channels.map((c) => <option key={c.id} value={c.id}>{markets.find((m) => m.id === c.market_id)?.name} · {c.name}</option>)}
                </Select>
              </Field>
              <Field label="SKU (for shelf price)">
                <Select name="sku_config_id" defaultValue=""><option value="">—</option>{setup.skus.map((s) => <option key={s.id} value={s.id}>{s.sku_code}</option>)}</Select>
              </Field>
              <Field label="Shelf price (market currency)"><Input name="shelf_price" inputMode="decimal" /></Field>
              <Field label="Channel margin %"><Input name="retailer_margin" inputMode="decimal" /></Field>
              <Field label="Rebate %"><Input name="rebate" inputMode="decimal" /></Field>
              <Field label="Payment days"><Input name="receivable_days" inputMode="numeric" /></Field>
              <Field label="Listing fees"><Input name="listing_fee_total" inputMode="decimal" /></Field>
              <Field label="Returns %"><Input name="returns_pct" inputMode="decimal" /></Field>
              <Field label="Delivery mode"><Input name="delivery_mode" /></Field>
              <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
              <Field label="Source" className="sm:col-span-2"><Input name="source_label" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Save — and re-draft the supply-chain map</Button></div>
            </form>
          </Card>
        </div>
      ) : null}

      {step === 5 ? (
        <Card>
          <CardTitle>5 · Sales numbers</CardTitle>
          <p className="mb-3 text-sm text-muted-foreground">Monthly units and value by SKU × channel × country.</p>
          <SalesImport principalId={p.id} />
          {setup.sales.length ? (
            <ul className="mt-4 divide-y divide-border text-sm">
              {setup.sales.slice(-12).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                  <span>{setup.skus.find((s) => s.id === r.sku_config_id)?.sku_code} · {markets.find((m) => m.id === r.market_id)?.iso2} · {channels.find((c) => c.id === r.channel_id)?.name ?? '—'} · {r.month.slice(0, 7)}</span>
                  <span className="flex gap-3">
                    {r.units != null ? <Num t={leaf('sales_units', Number(r.units), 'units', { tag: r.source === 'actual' ? 'measured' : 'quoted', label: 'Units sold', source: { label: r.source.replace('_', ' '), asOf: r.month } })} /> : null}
                    {r.value != null ? <Num t={leaf('sales_value', Number(r.value), r.currency ?? '', { tag: r.source === 'actual' ? 'measured' : 'quoted', label: 'Sales value', source: { label: r.source.replace('_', ' '), asOf: r.month } })} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {step === 6 ? (
        <div className="space-y-4">
          <Card>
            <CardTitle>6 · Costs — freight quotes, warehouse / 3PL terms, marketing spend</CardTitle>
            <p className="mb-3 text-sm text-muted-foreground">Saved as market-level figures, so every play in that market uses them unless a play overrides.</p>
            <form action={saveCost} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="principal_id" value={p.id} />
              <Field label="Market"><Select name="market_id" required>{markets.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.currency})</option>)}</Select></Field>
              <Field label="Cost"><Select name="field" required>{COSTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Amount (market currency)"><Input name="value_num" inputMode="decimal" required /></Field>
              <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
              <Field label="Source (who quoted)"><Input name="source_label" /></Field>
              <Field label="Quote date"><Input name="as_of" type="date" /></Field>
              <Field label="Note" className="sm:col-span-2"><Input name="note" /></Field>
              <div className="sm:col-span-2"><Button type="submit">Save cost</Button></div>
            </form>
          </Card>
          {markets.map((m) => {
            const vals = idx.forEntity('market', m.id).filter((v) => COSTS.some(([k]) => k === v.field));
            return vals.length ? (
              <Card key={m.id}>
                <CardTitle>{m.name} cost figures</CardTitle>
                <ValueTable values={vals} idx={idx} />
              </Card>
            ) : null;
          })}
        </div>
      ) : null}

      <div className="flex justify-between">
        {step > 1 ? <ButtonLink href={`?step=${step - 1}`}>← Back</ButtonLink> : <span />}
        {step < 6 ? <ButtonLink href={`?step=${step + 1}`} variant="primary">Next step →</ButtonLink> : <ButtonLink href={`/principals/${p.id}`} variant="primary">Finish</ButtonLink>}
      </div>
    </div>
  );
}

function FeeTermForm({ principalId }: { principalId: string }) {
  return (
    <Disclosure summary="Add a fee term">
      <form action={addFeeTerm} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="principal_id" value={principalId} />
        <Field label="Model">
          <Select name="model" defaultValue="commission">
            <option value="retainer">Retainer (fixed per month)</option>
            <option value="commission">Commission (% of principal net sales)</option>
            <option value="profit_share">Profit share (% of market NPAT after payback)</option>
          </Select>
        </Field>
        <Field label="Amount or %"><Input name="amount" inputMode="decimal" required /></Field>
        <Field label="Currency (retainer)"><Input name="currency" defaultValue="SGD" maxLength={3} /></Field>
        <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
        <Field label="Start"><Input name="start_date" type="date" /></Field>
        <Field label="End"><Input name="end_date" type="date" /></Field>
        <Field label="Source" className="sm:col-span-2"><Input name="source_label" placeholder="Draft contract v2" /></Field>
        <div className="sm:col-span-2"><Button type="submit" variant="secondary">Add fee term</Button></div>
      </form>
    </Disclosure>
  );
}

function SiteForm({ principalId, site }: { principalId: string; site?: { id: string; name: string; country: string | null; lat: number | null; lng: number | null; capacity: string | null; moq: string | null; lead_time_days: number | null; incoterm: string | null; currency: string | null } }) {
  return (
    <form action={saveSite} className="grid gap-3 sm:grid-cols-3">
      <input type="hidden" name="principal_id" value={principalId} />
      {site ? <input type="hidden" name="id" value={site.id} /> : null}
      <Field label="Name" className="sm:col-span-2"><Input name="name" defaultValue={site?.name ?? ''} required /></Field>
      <Field label="Country (ISO)"><Input name="country" defaultValue={site?.country ?? ''} maxLength={2} /></Field>
      <Field label="Latitude"><Input name="lat" inputMode="decimal" defaultValue={site?.lat ?? ''} /></Field>
      <Field label="Longitude"><Input name="lng" inputMode="decimal" defaultValue={site?.lng ?? ''} /></Field>
      <Field label="Lead time (days)"><Input name="lead_time_days" inputMode="numeric" defaultValue={site?.lead_time_days ?? ''} /></Field>
      <Field label="Capacity"><Input name="capacity" defaultValue={site?.capacity ?? ''} /></Field>
      <Field label="MOQ"><Input name="moq" defaultValue={site?.moq ?? ''} /></Field>
      <Field label="Incoterm"><Input name="incoterm" defaultValue={site?.incoterm ?? 'EXW'} /></Field>
      <Field label="Currency"><Input name="currency" defaultValue={site?.currency ?? 'SGD'} maxLength={3} /></Field>
      <div className="self-end sm:col-span-2"><Button type="submit" variant="secondary">Save site</Button></div>
    </form>
  );
}
