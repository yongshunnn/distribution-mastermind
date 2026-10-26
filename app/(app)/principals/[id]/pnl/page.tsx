import { notFound } from 'next/navigation';
import { Button, Card, CardTitle, Empty, Field, Input, Notice, Select } from '@/components/ui';
import { TagSelect } from '@/components/forms';
import { Num } from '@/components/num';
import { fxRates, rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { principalSetup } from '@/lib/db/principals';
import { buildAllPlays } from '@/lib/db/plays';
import { principalFees, type FeeTerm } from '@/lib/calc/pnl';
import { calc, leaf } from '@/lib/calc/traced';
import { convertNumber, hasFx } from '@/lib/calc/fx';
import { addValue } from '@/app/actions/markets';

export default async function PrincipalPnl({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ market?: string; months?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const setup = await principalSetup(id);
  if (!setup) notFound();
  const [plays, markets, idx, fx] = await Promise.all([buildAllPlays(), rows('markets'), valueIndex(), fxRates()]);
  const mine = plays.filter((p) => p.principalId === id);
  const marketIds = [...new Set(mine.map((p) => p.market.id))];
  const market = markets.find((m) => m.id === sp.market) ?? markets.find((m) => m.id === marketIds[0]);
  const months = [12, 24, 36].includes(Number(sp.months)) ? Number(sp.months) : 12;
  if (!market) return <Empty title="No plays yet for this principal" />;
  const mp = mine.filter((p) => p.market.id === market.id);
  const toSgd = (v: number, cur: string) => (cur === 'SGD' ? v : hasFx(cur, 'SGD', fx) ? convertNumber(v, cur, 'SGD', fx) : 0);

  const salesParts = mp.map((p) => calc('principal_net_sales', toSgd(p.econ.pNet.value * p.inputs.q_realistic_month.value, p.market.currency), 'SGD/month', 'P_net × Q_realistic (→ SGD)', [p.econ.pNet, p.inputs.q_realistic_month], { label: p.play.name ?? p.sku.sku_code }));
  const netSales = calc('principal_net_sales', salesParts.reduce((s, x) => s + x.value, 0), 'SGD/month', 'Σ plays P_net × Q', salesParts, { label: 'Principal net sales / month', meaning: `Net sales of ${setup.principal.name} products in ${market.name} at realistic volumes.` });
  const npatOverride = idx.get('principal', id, `npat_monthly_${market.iso2}`);
  const npatParts = mp.map((p) => calc('play_profit', toSgd(p.econ.perMonth.value - p.inputs.fixed_monthly_cost.value, p.market.currency), 'SGD/month', 'C × Q − F (→ SGD)', [p.econ.perMonth, p.inputs.fixed_monthly_cost], { label: p.play.name ?? p.sku.sku_code }));
  const npat = npatOverride
    ? tracedFromValue(npatOverride, idx, 'market_npat', 'Monthly market NPAT entered for this principal.')
    : calc('market_npat', npatParts.reduce((s, x) => s + x.value, 0), 'SGD/month', 'Σ (play contribution − channel fixed cost)', npatParts, { label: 'Market NPAT / month (approx.)', meaning: 'Approximation until actual P&L figures are entered: contribution minus channel fixed costs, before tax.' });
  const invV = idx.get('principal', id, `investment_${market.iso2}`);
  const investment = invV ? tracedFromValue(invV, idx, 'principal_investment') : leaf('principal_investment', 0, 'SGD', { tag: 'placeholder', label: 'Principal investment to pay back', note: 'Not entered — profit share starts immediately.' });
  const terms: FeeTerm[] = setup.fees.map((f) => {
    const t = f.amount ? tracedFromValue(f.amount, idx) : leaf('amount_or_pct', 0, '', { tag: 'placeholder' });
    const amount = f.model === 'retainer' ? { ...t, value: toSgd(t.value, f.currency), unit: 'SGD/month' } : t;
    return { id: f.id, model: f.model, amount, basis: f.basis };
  });
  const res = principalFees(terms, netSales, npat, investment, 'SGD', months);

  return (
    <div className="space-y-4">
      <form method="get" className="flex flex-wrap items-end gap-2">
        <Field label="Market"><Select name="market" defaultValue={market.id}>{markets.filter((m) => marketIds.includes(m.id)).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Field label="Months"><Select name="months" defaultValue={String(months)}><option value="12">12</option><option value="24">24</option><option value="36">36</option></Select></Field>
        <Button type="submit" variant="secondary">Show</Button>
      </form>
      {!setup.fees.length ? <Notice tone="warn">No fee terms yet — add retainer, commission or profit-share terms in setup step 1.</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><p className="text-xs text-muted-foreground">Fee income ({months} months)</p><Num t={res.total} size="xl" /></Card>
        <Card><p className="text-xs text-muted-foreground">Principal net sales / month</p><Num t={netSales} size="lg" /></Card>
        <Card><p className="text-xs text-muted-foreground">Market NPAT / month</p><Num t={npat} size="lg" /></Card>
        <Card><p className="text-xs text-muted-foreground">Investment to pay back</p><Num t={investment} size="lg" /><p className="text-xs text-muted-foreground">{res.paybackMonth ? `Paid back in month ${res.paybackMonth}` : 'Not paid back in this window'}</p></Card>
      </div>
      <Card>
        <CardTitle>By fee model</CardTitle>
        <ul className="divide-y divide-border">{res.byModel.map((b) => <li key={b.key} className="flex justify-between py-2 text-sm"><span>{b.label}</span><Num t={b} /></li>)}</ul>
      </Card>
      <Card className="overflow-x-auto">
        <CardTitle>Month by month (SGD)</CardTitle>
        <table className="w-full min-w-[32rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Month</th><th>Retainer</th><th>Commission</th><th>Profit share</th><th>Cumulative NPAT</th></tr></thead>
          <tbody>
            {res.months.map((m) => {
              const t = (k: string, v: number, label: string) => calc(k, v, 'SGD', label, k === 'cum_npat' ? [npat] : terms.map((x) => x.amount), { label: `Month ${m.month} — ${label}` });
              return (
                <tr key={m.month} className={`border-t border-border ${m.paidBack ? '' : 'text-muted-foreground'}`}>
                  <td className="py-1">{m.month}</td>
                  <td><Num t={t('fee_retainer', m.retainer, 'retainer')} /></td>
                  <td><Num t={t('fee_commission', m.commission, 'commission')} /></td>
                  <td><Num t={t('fee_profit_share', m.profitShare, 'profit share')} /></td>
                  <td><Num t={t('cum_npat', m.cumulativeNpat, 'cumulative NPAT')} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardTitle>Enter actuals for {market.name}</CardTitle>
        <form action={addValue} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="entity_type" value="principal" />
          <input type="hidden" name="entity_id" value={id} />
          <input type="hidden" name="unit" value="SGD" />
          <Field label="Figure">
            <Select name="field">
              <option value={`investment_${market.iso2}`}>Principal investment to pay back (SGD)</option>
              <option value={`npat_monthly_${market.iso2}`}>Market NPAT per month (SGD)</option>
            </Select>
          </Field>
          <Field label="Amount (SGD)"><Input name="value_num" inputMode="decimal" required /></Field>
          <Field label="Tag"><TagSelect defaultValue="quoted" /></Field>
          <Field label="Source"><Input name="source_label" /></Field>
          <div className="sm:col-span-2"><Button type="submit" variant="secondary">Save</Button></div>
        </form>
      </Card>
    </div>
  );
}
