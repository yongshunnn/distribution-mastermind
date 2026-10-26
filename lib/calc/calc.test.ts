import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/lmax.json';
import { buildBackLevers, chainLayers, playEconomics, playEconomicsLite, withSensitivities } from './play';
import { convert, convertNumber, fxRate, type FxRate } from './fx';
import { dutyRate, pickDutyRule, type TradeRule } from './trade';
import { calc, leaf, sensitivity, weakestTag } from './traced';
import { makeInputs } from './test-helpers';
import { marketScore } from './score';
import { principalFees } from './pnl';
import { planScenario } from './scenario';
import { auditSummary, mainstreamCluster } from './audit';
import { rangeGaps } from './rangegap';
import { judgeAsk, pickBenchmark } from './benchmark';

const ctx = { currency: 'SGD', distributorTier: false };

describe('§8.10 required tests', () => {
  it('contribution with all-zero costs equals P_net', () => {
    const i = makeInputs({ shelf_price: 10.9, sales_tax_rate: 0.09, retailer_margin: 0.3, rebate: 0.02, units_per_order: 12 });
    const e = playEconomics(i, ctx);
    expect(e.landed.value).toBe(0);
    expect(e.C.value).toBeCloseTo(e.pNet.value, 10);
    expect(e.pNet.value).toBeCloseTo(10 * (1 - 0.3 - 0.02), 10);
  });

  it('duty uses MFN when coo_form is missing', () => {
    const rules: TradeRule[] = [
      { id: 'mfn', hs_code: '3402.90', origin_iso2: null, dest_iso2: 'MY', regime: 'MFN', coo_form: null, duty_pct: 5, tag: 'estimated' },
      { id: 'atiga', hs_code: '3402.90', origin_iso2: 'SG', dest_iso2: 'MY', regime: 'ATIGA', coo_form: 'Form D', duty_pct: 0, tag: 'estimated' },
    ];
    expect(pickDutyRule(rules, '3402.90.1000', 'SG', 'MY', [])?.id).toBe('mfn');
    expect(dutyRate(rules, '340290', 'SG', 'MY').value).toBeCloseTo(0.05);
    expect(dutyRate(rules, '340290', 'SG', 'MY').note).toMatch(/MFN/);
    expect(pickDutyRule(rules, '3402.90', 'SG', 'MY', ['Form D'])?.id).toBe('atiga');
    // A certificate for a different regime does not unlock ATIGA.
    expect(pickDutyRule(rules, '3402.90', 'SG', 'MY', ['Form E'])?.id).toBe('mfn');
  });

  it('L_max matches the hand-computed fixture', () => {
    const i = makeInputs(fixture.inputs as Record<string, number>);
    const e = playEconomics(i, { currency: 'SGD', distributorTier: fixture.distributorTier });
    expect(e.lMax.value).toBeCloseTo(fixture.expected.l_max, 10);
    expect(e.landed.value).toBeCloseTo(fixture.expected.landed, 10);
    expect(e.headroom.value).toBeCloseTo(fixture.expected.headroom, 10);
  });

  it('tag inheritance: any placeholder input makes the result placeholder', () => {
    const i = makeInputs({ shelf_price: 10, supplier_price: 2 }, { freight_per_unit: 'placeholder' });
    const e = playEconomics(i, ctx);
    expect(e.landed.tag).toBe('placeholder');
    expect(e.C.tag).toBe('placeholder');
    expect(e.R.tag).toBe('placeholder');
    // Inputs not touching freight are unaffected.
    expect(e.pNet.tag).toBe('measured');
    expect(weakestTag(['measured', 'public', 'estimated'])).toBe('estimated');
    expect(calc('x', 1, 'u', 'a+b', [leaf('a', 1, 'u', { tag: 'quoted' }), leaf('b', 0, 'u', { tag: 'placeholder' })]).tag).toBe('placeholder');
  });

  it('FX conversion round-trips', () => {
    const rates: FxRate[] = [
      { base: 'MYR', quote: 'SGD', rate: 0.3141, month: '2026-08-01' },
      { base: 'MMK', quote: 'SGD', rate: 0.00062, month: '2026-08-01' },
    ];
    const myr = 1234.56;
    const sgd = convertNumber(myr, 'MYR', 'SGD', rates);
    expect(sgd).toBeCloseTo(myr * 0.3141, 10);
    expect(convertNumber(sgd, 'SGD', 'MYR', rates)).toBeCloseTo(myr, 8);
    // Cross rate through SGD, and back.
    const mmk = convertNumber(myr, 'MYR', 'MMK', rates);
    expect(convertNumber(mmk, 'MMK', 'MYR', rates)).toBeCloseTo(myr, 6);
    const t = convert(leaf('supplier_price', 2, 'SGD/unit', { tag: 'quoted' }), 'SGD', 'MYR', rates);
    expect(t.unit).toBe('MYR/unit');
    expect(t.tag).toBe('public');
    expect(fxRate('SGD', 'SGD', rates).value).toBe(1);
  });
});

describe('play economics', () => {
  it('lite path matches the traced path', () => {
    const i = makeInputs({ ...fixture.inputs, rebate: 0.02, listing_fee_total: 500, listing_period_units: 5000, annual_finance_rate: 0.08, receivable_days: 60, payable_days: 30, q_realistic_month: 2000, entry_cost: 3000, duty_rate: 0.05, import_tax_rate: 0.1, clearance_per_unit: 0.05 } as Record<string, number>);
    const c = { currency: 'MYR', distributorTier: true };
    const e = playEconomics(i, c);
    const l = playEconomicsLite(i, c);
    expect(l.C).toBeCloseTo(e.C.value, 10);
    expect(l.lMax).toBeCloseTo(e.lMax.value, 10);
    expect(l.R).toBeCloseTo(e.R.value, 10);
    expect(l.headroom).toBeCloseTo(e.C.value, 10); // headroom equals contribution by construction
  });

  it('non-recoverable import tax is a landed cost; recoverable is not', () => {
    const base = { supplier_price: 10, duty_rate: 0.1, import_tax_rate: 0.1 };
    expect(playEconomics(makeInputs(base), ctx).landed.value).toBeCloseTo(10 + 1 + 1.1);
    expect(playEconomics(makeInputs({ ...base, import_tax_recoverable: 1 }), ctx).landed.value).toBeCloseTo(11);
  });

  it('break-even is n/a when contribution is negative', () => {
    const e = playEconomics(makeInputs({ shelf_price: 1, supplier_price: 5, fixed_monthly_cost: 100 }), ctx);
    expect(e.C.value).toBeLessThan(0);
    expect(e.breakeven.na).toMatch(/Never/);
  });

  it('staircase layers stack exactly to the shelf price', () => {
    for (const tier of [true, false]) {
      const i = makeInputs({ ...fixture.inputs, rebate: 0.03, listing_fee_total: 200, listing_period_units: 1000, import_tax_rate: 0.1, duty_rate: 0.05 } as Record<string, number>);
      const c = { currency: 'SGD', distributorTier: tier };
      const e = playEconomics(i, c);
      const layers = chainLayers(e, i, c);
      const total = layers.filter((l) => l.kind !== 'loss').reduce((s, l) => s + l.t.value, 0) + layers.filter((l) => l.kind === 'loss').reduce((s, l) => s + l.t.value, 0);
      expect(total).toBeCloseTo(10.9, 10);
    }
  });

  it('levers solve negative headroom to zero', () => {
    const i = makeInputs({ shelf_price: 5, sales_tax_rate: 0.09, retailer_margin: 0.3, supplier_price: 4 });
    const e = playEconomics(i, ctx);
    expect(e.headroom.value).toBeLessThan(0);
    const levers = buildBackLevers(i, ctx);
    const shelf = levers.find((l) => l.inputKey === 'shelf_price')!;
    const fixed = makeInputs({ shelf_price: shelf.to, sales_tax_rate: 0.09, retailer_margin: 0.3, supplier_price: 4 });
    expect(playEconomics(fixed, ctx).headroom.value).toBeCloseTo(0, 6);
  });

  it('sensitivity ranks the biggest input first', () => {
    const i = makeInputs({ shelf_price: 10, supplier_price: 2, marketing_per_unit: 0.1 });
    const s = sensitivity(i, (x) => playEconomicsLite(x, ctx).C);
    expect(s[0].inputKey).toBe('shelf_price');
    expect(withSensitivities(playEconomics(i, ctx), i, ctx).C.sensitivity?.length).toBeGreaterThan(0);
  });
});

describe('other engines', () => {
  it('market score is the weighted mean', () => {
    const f = (v: number) => leaf('s', v, 'score', { tag: 'estimated' });
    const w = (v: number) => leaf('w', v, '%', { tag: 'computed' });
    const s = marketScore(
      { size: f(80), access: f(60), competition: f(40), right_to_win: f(50), growth: f(70) },
      { size: w(0.25), access: w(0.2), competition: w(0.2), right_to_win: w(0.2), growth: w(0.15) },
    );
    expect(s.value).toBeCloseTo(80 * 0.25 + 60 * 0.2 + 40 * 0.2 + 50 * 0.2 + 70 * 0.15);
    expect(s.tag).toBe('estimated');
  });

  it('profit share starts only after payback', () => {
    const t = (v: number) => leaf('a', v, 'x', { tag: 'quoted' });
    const r = principalFees(
      [{ id: '1', model: 'retainer', amount: t(1000) }, { id: '2', model: 'commission', amount: t(0.03) }, { id: '3', model: 'profit_share', amount: t(0.2) }],
      t(50000), t(10000), t(25000), 'SGD', 6,
    );
    expect(r.paybackMonth).toBe(3);
    expect(r.months[0].profitShare).toBe(0);
    expect(r.months[2].profitShare).toBeCloseTo(0.2 * 5000); // only the 5k above payback in month 3
    expect(r.months[3].profitShare).toBeCloseTo(0.2 * 10000);
    expect(r.byModel.find((b) => b.key === 'fee_retainer')!.value).toBe(6000);
    expect(r.byModel.find((b) => b.key === 'fee_commission')!.value).toBeCloseTo(9000);
  });

  it('scenario respects the capital cap and reports cash need', () => {
    const plays = [
      { id: 'a', name: 'A', R: 2, contributionMonth: 1000, entryCost: 5000, peakCash: 5000, people: 0.5, pallets: 4 },
      { id: 'b', name: 'B', R: 3, contributionMonth: 2000, entryCost: 8000, peakCash: 8000, people: 0.5, pallets: 4 },
      { id: 'c', name: 'C', R: 1, contributionMonth: 500, entryCost: 1000, peakCash: 1000, people: 0.5, pallets: 4 },
    ];
    const r = planScenario(plays, { capital: 20000 });
    expect(r.plan.map((p) => p.id)).toEqual(['b', 'a', 'c']);
    expect(r.plan.filter((p) => p.included).map((p) => p.id)).toEqual(['b', 'c']);
    expect(r.plan.find((p) => p.id === 'a')!.reason).toMatch(/capital/);
    expect(r.fundingNeed).toBeCloseTo(18000 - 2500);
  });

  it('audit summary finds the mainstream cluster', () => {
    const o = (id: string, price: number, size = 1, unit = 'l', origin: 'local' | 'imported' = 'local') => ({ id, brand: id, pack_size: size, pack_unit: unit, price, currency: 'MMK', facings: 2, origin });
    const obs = [o('a', 4800), o('b', 5200), o('c', 5500), o('d', 6000), o('e', 3890), o('f', 32200, 1, 'l', 'imported'), o('g', 2750, 500, 'ml')];
    const s = auditSummary(obs, 'MMK')!;
    expect(s.priceLow.value).toBe(3890);
    expect(s.priceHigh.value).toBe(32200);
    expect(s.clusterLow.value).toBeGreaterThanOrEqual(4800);
    expect(s.clusterHigh.value).toBeLessThanOrEqual(6000);
    expect(s.localShare!.value).toBeCloseTo(6 / 7);
    expect(mainstreamCluster([1, 1.05, 1.1, 5]).count).toBe(3);
  });

  it('range gaps list rival sizes we do not cover', () => {
    const gaps = rangeGaps(
      [{ size: 500, unit: 'ml', who: 'us' }, { size: 1, unit: 'l', who: 'us' }, { size: 5, unit: 'l', who: 'us' }],
      [{ size: 450, unit: 'ml', who: 'E-Lan' }, { size: 3.5, unit: 'l', who: 'City Value' }, { size: 1.2, unit: 'kg', who: 'E-Lan' }],
    );
    expect(gaps.map((g) => g.size)).toEqual(['3.5L', '1.2kg']) // liquids first, then powders;
  });

  it('Golden Land 15% margin ask is above the Myanmar 4–8% benchmark', () => {
    const b = [
      { id: '1', market_id: null, role: 'Distributor', metric: 'gross_margin', low: 5, high: 12 },
      { id: '2', market_id: 'mm', role: 'Distributor', metric: 'gross_margin', low: 4, high: 8 },
    ];
    const picked = pickBenchmark(b, 'distributor', 'gross_margin', 'mm');
    expect(picked?.id).toBe('2');
    expect(judgeAsk({ metric: 'gross_margin', value: 15 }, picked)).toBe('above');
    expect(judgeAsk({ metric: 'gross_margin', value: 8 }, pickBenchmark(b, 'distributor', 'gross_margin', 'my'))).toBe('within');
  });
});
