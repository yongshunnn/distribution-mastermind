// Play economics (spec §8.1–8.5, 8.7, 8.9). Pure functions; all money in the play's market currency.
import { calc, constant, sensitivity, sum, type Lever, type Traced } from './traced';

export const PLAY_INPUT_KEYS = [
  'supplier_price',
  'origin_handling_per_unit',
  'freight_per_unit',
  'insurance_per_unit',
  'duty_rate',
  'import_tax_rate',
  'import_tax_recoverable',
  'clearance_per_unit',
  'shelf_price',
  'sales_tax_rate',
  'retailer_margin',
  'distributor_margin',
  'rebate',
  'listing_fee_total',
  'listing_period_units',
  'pallet_cost_per_day',
  'stock_days',
  'units_per_pallet',
  'handling_per_order',
  'units_per_order',
  'delivery_cost_per_drop',
  'units_per_drop',
  'marketing_per_unit',
  'annual_finance_rate',
  'receivable_days',
  'payable_days',
  'fixed_monthly_cost',
  'volume_per_unit_m3',
  'q_realistic_month',
  'entry_cost',
] as const;

export type PlayInputKey = (typeof PLAY_INPUT_KEYS)[number];
export type PlayInputs = Record<PlayInputKey, Traced>;

export interface PlayContext {
  currency: string;
  /** True when a distributor buys from us and sells on to retailers (two margins). */
  distributorTier: boolean;
  /** Settings threshold for value density flag, in currency per m³. */
  valueDensityThreshold?: number;
}

export interface PlayEconomics {
  cif: Traced;
  duty: Traced;
  importTax: Traced;
  landed: Traced;
  listPrice: Traced;
  channelMargin: Traced;
  tradeSpend: Traced;
  pNet: Traced;
  W: Traced;
  D: Traced;
  M: Traced;
  K: Traced;
  C: Traced;
  perOrder: Traced;
  perMonth: Traced;
  breakeven: Traced;
  valueDensity: Traced;
  valueDensityLow: boolean;
  costToServe: Traced;
  lMax: Traced;
  headroom: Traced;
  peakCash: Traced;
  annualAfterEntry: Traced;
  R: Traced;
}

const DAYS_PER_MONTH = 365 / 12;

export function landedCost(i: Pick<PlayInputs, 'supplier_price' | 'origin_handling_per_unit' | 'freight_per_unit' | 'insurance_per_unit' | 'duty_rate' | 'import_tax_rate' | 'import_tax_recoverable' | 'clearance_per_unit'>, cur: string) {
  const u = `${cur}/unit`;
  const cif = sum('cif', u, [i.supplier_price, i.origin_handling_per_unit, i.freight_per_unit, i.insurance_per_unit]);
  const duty = calc('duty', cif.value * i.duty_rate.value, u, 'CIF × duty rate', [cif, i.duty_rate]);
  const taxBase = cif.value + duty.value;
  const importTax = calc('import_tax', taxBase * i.import_tax_rate.value, u, '(CIF + duty) × import tax rate', [cif, duty, i.import_tax_rate]);
  const recoverable = i.import_tax_recoverable.value >= 0.5;
  const parts = [cif, duty, i.clearance_per_unit, ...(recoverable ? [] : [importTax])];
  const landed = calc(
    'landed_cost',
    parts.reduce((s, p) => s + p.value, 0),
    u,
    recoverable ? 'CIF + duty + clearance (import tax recoverable — only a cash-timing cost)' : 'CIF + duty + clearance + import tax',
    [...parts, i.import_tax_recoverable],
  );
  return { cif, duty, importTax, landed };
}

/** Compute every output of a play. */
export function playEconomics(i: PlayInputs, ctx: PlayContext): PlayEconomics {
  const cur = ctx.currency;
  const u = `${cur}/unit`;
  const { cif, duty, importTax, landed } = landedCost(i, cur);

  // Price chain: shelf (incl. tax) → ex-tax → (retailer margin, if a distributor sits between) → list to our customer.
  const exTaxFactor = 1 / (1 + i.sales_tax_rate.value);
  const listValue = i.shelf_price.value * exTaxFactor * (ctx.distributorTier ? 1 - i.retailer_margin.value : 1);
  const listPrice = calc(
    'list_price',
    listValue,
    u,
    ctx.distributorTier ? 'shelf ÷ (1 + t) × (1 − retailer margin)' : 'shelf ÷ (1 + t)',
    ctx.distributorTier ? [i.shelf_price, i.sales_tax_rate, i.retailer_margin] : [i.shelf_price, i.sales_tax_rate],
  );
  const cm = ctx.distributorTier ? i.distributor_margin : i.retailer_margin;
  const channelMargin = calc('channel_margin', cm.value, '%', ctx.distributorTier ? 'distributor margin' : 'retailer / channel margin', [cm]);

  const listingPerUnit = i.listing_period_units.value > 0 ? i.listing_fee_total.value / i.listing_period_units.value : 0;
  const tradeSpend = calc(
    'trade_spend_per_unit',
    listPrice.value * i.rebate.value + listingPerUnit,
    u,
    'list × rebate + listing fees ÷ units over listing period',
    [listPrice, i.rebate, i.listing_fee_total, i.listing_period_units],
  );
  const pNet = calc(
    'p_net',
    listPrice.value * (1 - channelMargin.value - i.rebate.value) - listingPerUnit,
    u,
    'list × (1 − channel margin − rebate) − listing fee total ÷ expected units',
    [listPrice, channelMargin, i.rebate, i.listing_fee_total, i.listing_period_units],
  );

  const W = calc(
    'warehousing_per_unit',
    (i.units_per_pallet.value > 0 ? (i.pallet_cost_per_day.value * i.stock_days.value) / i.units_per_pallet.value : 0) +
      (i.units_per_order.value > 0 ? i.handling_per_order.value / i.units_per_order.value : 0),
    u,
    'pallet cost/day × stock days ÷ units per pallet + handling per order ÷ units per order',
    [i.pallet_cost_per_day, i.stock_days, i.units_per_pallet, i.handling_per_order, i.units_per_order],
  );
  const D = calc(
    'delivery_per_unit',
    i.units_per_drop.value > 0 ? i.delivery_cost_per_drop.value / i.units_per_drop.value : 0,
    u,
    'delivery cost per drop ÷ units per drop',
    [i.delivery_cost_per_drop, i.units_per_drop],
  );
  const M = calc('marketing_per_unit', i.marketing_per_unit.value, u, 'marketing per unit', [i.marketing_per_unit]);
  const days365 = constant('days_per_year', 365, 'days', 'Days per year');
  const K = calc(
    'cash_cost_per_unit',
    (landed.value * i.annual_finance_rate.value * (i.stock_days.value + i.receivable_days.value - i.payable_days.value)) / 365,
    u,
    'L × finance rate × (stock days + receivable days − payable days) ÷ 365',
    [landed, i.annual_finance_rate, i.stock_days, i.receivable_days, i.payable_days, days365],
  );

  const Cv = pNet.value - landed.value - W.value - D.value - M.value - K.value;
  const C = calc('contribution_per_unit', Cv, u, 'P_net − L − W − D − M − K', [pNet, landed, W, D, M, K]);
  const perOrder = calc('contribution_per_order', Cv * i.units_per_order.value, `${cur}/order`, 'C × units per order', [C, i.units_per_order]);
  const perMonth = calc('contribution_per_month', Cv * i.q_realistic_month.value, `${cur}/month`, 'C × Q_realistic', [C, i.q_realistic_month]);

  const breakeven = calc(
    'breakeven_units',
    Cv > 0 ? i.fixed_monthly_cost.value / Cv : 0,
    'units/month',
    'F ÷ C',
    [i.fixed_monthly_cost, C],
    { na: Cv > 0 ? undefined : 'Never — contribution per unit is zero or negative' },
  );

  const vd = i.volume_per_unit_m3.value > 0 ? pNet.value / i.volume_per_unit_m3.value : 0;
  const valueDensityLow = ctx.valueDensityThreshold !== undefined && vd < ctx.valueDensityThreshold;
  const valueDensity = calc('value_density', vd, `${cur}/m³`, 'P_net ÷ volume per unit (m³)', [pNet, i.volume_per_unit_m3], {
    note: valueDensityLow ? 'Below the value-density threshold — freight and space will eat margin. Consider local co-packing.' : undefined,
  });

  // Build-back (spec §8.5). S = W + D + K + trade spend + M, so headroom equals contribution at the target shelf price.
  const costToServe = sum('cost_to_serve', u, [W, D, K, tradeSpend, M]);
  const mDist = ctx.distributorTier ? i.distributor_margin.value : 0;
  const lMaxValue = i.shelf_price.value * exTaxFactor * (1 - i.retailer_margin.value) * (1 - mDist) - costToServe.value;
  const headroomValue = lMaxValue - landed.value;
  const levers = headroomValue < 0 ? buildBackLevers(i, ctx, headroomValue) : undefined;
  const lMax = calc(
    'l_max',
    lMaxValue,
    u,
    'P_shelf ÷ (1 + t) × (1 − m_retail) × (1 − m_dist) − S',
    [i.shelf_price, i.sales_tax_rate, i.retailer_margin, ...(ctx.distributorTier ? [i.distributor_margin] : []), costToServe],
  );
  const headroom = calc('headroom', headroomValue, u, 'L_max − L', [lMax, landed], {
    levers,
    note: headroomValue < 0 ? 'The target shelf price does not cover landed cost. See what would need to move.' : undefined,
  });

  // Return on cash (spec §8.7).
  const Q = i.q_realistic_month.value;
  const stockValue = (landed.value * Q * i.stock_days.value) / DAYS_PER_MONTH;
  const receivables = (pNet.value * Q * i.receivable_days.value) / DAYS_PER_MONTH;
  const payables = (landed.value * Q * i.payable_days.value) / DAYS_PER_MONTH;
  const peakValue = Math.max(0, stockValue + receivables - payables);
  const peakCash = calc(
    'peak_cash',
    peakValue,
    cur,
    'L × Q × stock days ÷ 30.4 + P_net × Q × receivable days ÷ 30.4 − L × Q × payable days ÷ 30.4',
    [landed, pNet, i.q_realistic_month, i.stock_days, i.receivable_days, i.payable_days],
  );
  const twelve = constant('months_per_year', 12, 'months', 'Months per year');
  const annualAfterEntry = calc(
    'annual_contribution_after_entry',
    Cv * Q * 12 - i.entry_cost.value,
    cur,
    'C × Q × 12 − E',
    [C, i.q_realistic_month, twelve, i.entry_cost],
  );
  const R = calc('return_on_cash', peakValue > 0 ? annualAfterEntry.value / peakValue : 0, '%', '(C × Q × 12 − E) ÷ peak cash', [annualAfterEntry, peakCash], {
    na: peakValue > 0 ? undefined : 'No cash tied up — set volume and stock days',
  });

  return {
    cif, duty, importTax, landed, listPrice, channelMargin, tradeSpend, pNet, W, D, M, K, C, perOrder, perMonth,
    breakeven, valueDensity, valueDensityLow, costToServe, lMax, headroom, peakCash, annualAfterEntry, R,
  };
}

/** Headroom only — used for lever solving. */
function headroomOf(i: PlayInputs, ctx: PlayContext): number {
  const e = playEconomicsLite(i, ctx);
  return e.headroom;
}

/** Same arithmetic as playEconomics without building Traced trees (fast path for sensitivity and sliders). */
export function playEconomicsLite(i: PlayInputs, ctx: PlayContext) {
  const v = (k: PlayInputKey) => i[k].value;
  const cif = v('supplier_price') + v('origin_handling_per_unit') + v('freight_per_unit') + v('insurance_per_unit');
  const duty = cif * v('duty_rate');
  const tax = (cif + duty) * v('import_tax_rate');
  const L = cif + duty + v('clearance_per_unit') + (v('import_tax_recoverable') >= 0.5 ? 0 : tax);
  const exTax = v('shelf_price') / (1 + v('sales_tax_rate'));
  const list = exTax * (ctx.distributorTier ? 1 - v('retailer_margin') : 1);
  const cm = ctx.distributorTier ? v('distributor_margin') : v('retailer_margin');
  const listing = v('listing_period_units') > 0 ? v('listing_fee_total') / v('listing_period_units') : 0;
  const pNet = list * (1 - cm - v('rebate')) - listing;
  const W = (v('units_per_pallet') > 0 ? (v('pallet_cost_per_day') * v('stock_days')) / v('units_per_pallet') : 0) +
    (v('units_per_order') > 0 ? v('handling_per_order') / v('units_per_order') : 0);
  const D = v('units_per_drop') > 0 ? v('delivery_cost_per_drop') / v('units_per_drop') : 0;
  const M = v('marketing_per_unit');
  const K = (L * v('annual_finance_rate') * (v('stock_days') + v('receivable_days') - v('payable_days'))) / 365;
  const C = pNet - L - W - D - M - K;
  const S = W + D + K + list * v('rebate') + listing + M;
  const lMax = exTax * (1 - v('retailer_margin')) * (1 - (ctx.distributorTier ? v('distributor_margin') : 0)) - S;
  const Q = v('q_realistic_month');
  const peak = Math.max(0, (L * Q * v('stock_days') + pNet * Q * v('receivable_days') - L * Q * v('payable_days')) / DAYS_PER_MONTH);
  const annual = C * Q * 12 - v('entry_cost');
  return { cif, duty, tax, L, list, pNet, W, D, M, K, C, S, lMax, headroom: lMax - L, peak, annual, R: peak > 0 ? annual / peak : 0, perMonth: C * Q };
}

const LEVER_KEYS: { key: PlayInputKey; label: string }[] = [
  { key: 'shelf_price', label: 'Shelf price' },
  { key: 'retailer_margin', label: 'Retailer / channel margin' },
  { key: 'distributor_margin', label: 'Distributor margin' },
  { key: 'supplier_price', label: 'Supplier price' },
  { key: 'freight_per_unit', label: 'Freight per unit' },
  { key: 'marketing_per_unit', label: 'Marketing per unit' },
];

/** For negative headroom: how far each single lever would need to move to reach zero (others held). */
export function buildBackLevers(i: PlayInputs, ctx: PlayContext, headroom = headroomOf(i, ctx)): Lever[] {
  const out: Lever[] = [];
  for (const { key, label } of LEVER_KEYS) {
    if (key === 'distributor_margin' && !ctx.distributorTier) continue;
    const t = i[key];
    const step = t.unit === '%' ? 0.01 : Math.max(Math.abs(t.value) * 0.01, 0.01);
    const bumped = { ...i, [key]: { ...t, value: t.value + step } };
    const slope = (headroomOf(bumped, ctx) - headroom) / step;
    if (Math.abs(slope) < 1e-12) continue;
    const to = t.value - headroom / slope;
    if (t.unit === '%' && (to < 0 || to >= 1)) continue;
    if (t.unit !== '%' && to < 0) continue;
    out.push({ label, inputKey: key, from: t.value, to, unit: t.unit });
  }
  return out;
}

/** Attach sensitivity (±10% per input) to the headline outputs. */
export function withSensitivities(e: PlayEconomics, i: PlayInputs, ctx: PlayContext): PlayEconomics {
  const sens = (pick: (x: ReturnType<typeof playEconomicsLite>) => number) => sensitivity(i, (ii) => pick(playEconomicsLite(ii, ctx)));
  return {
    ...e,
    landed: { ...e.landed, sensitivity: sens((x) => x.L) },
    pNet: { ...e.pNet, sensitivity: sens((x) => x.pNet) },
    C: { ...e.C, sensitivity: sens((x) => x.C) },
    perMonth: { ...e.perMonth, sensitivity: sens((x) => x.perMonth) },
    headroom: { ...e.headroom, sensitivity: sens((x) => x.headroom) },
    lMax: { ...e.lMax, sensitivity: sens((x) => x.lMax) },
    R: { ...e.R, sensitivity: sens((x) => x.R) },
  };
}

/** Break-even volume as a standalone (spec §8.3). */
export function breakevenVolume(F: Traced, C: Traced): Traced {
  return calc('breakeven_units', C.value > 0 ? F.value / C.value : 0, 'units/month', 'F ÷ C', [F, C], {
    na: C.value > 0 ? undefined : 'Never — contribution per unit is zero or negative',
  });
}

/** Max affordable landed cost (spec §8.5) as a standalone. */
export function maxLandedCost(shelf: Traced, t: Traced, mRetail: Traced, mDist: Traced, S: Traced, unit: string): Traced {
  const v = (shelf.value / (1 + t.value)) * (1 - mRetail.value) * (1 - mDist.value) - S.value;
  return calc('l_max', v, unit, 'P_shelf ÷ (1 + t) × (1 − m_retail) × (1 − m_dist) − S', [shelf, t, mRetail, mDist, S]);
}

/** One cost layer of the factory-to-consumer staircase (spec §11). */
export interface ChainLayer {
  stage: ChainStage;
  kind: 'product' | 'logistics' | 'duty_tax' | 'warehouse' | 'delivery' | 'marketing' | 'contribution' | 'loss' | 'trade' | 'channel_margin' | 'retail_margin' | 'sales_tax';
  t: Traced;
}

export const CHAIN_STAGES = [
  'Production',
  'Origin logistics',
  'Main freight',
  'Import',
  'Warehouse',
  'Delivery to channel',
  'Channel',
  'Outlet / end user',
  'Consumer',
] as const;
export type ChainStage = (typeof CHAIN_STAGES)[number];

/** Per-unit layers in stage order. Stacked, they rise from zero to the shelf price. */
export function chainLayers(e: PlayEconomics, i: PlayInputs, ctx: PlayContext): ChainLayer[] {
  const u = `${ctx.currency}/unit`;
  const recoverable = i.import_tax_recoverable.value >= 0.5;
  const layers: ChainLayer[] = [
    { stage: 'Production', kind: 'product', t: i.supplier_price },
    { stage: 'Origin logistics', kind: 'logistics', t: i.origin_handling_per_unit },
    { stage: 'Main freight', kind: 'logistics', t: i.freight_per_unit },
    { stage: 'Main freight', kind: 'logistics', t: i.insurance_per_unit },
    { stage: 'Import', kind: 'duty_tax', t: e.duty },
    { stage: 'Import', kind: 'logistics', t: i.clearance_per_unit },
    ...(recoverable ? [] : [{ stage: 'Import' as const, kind: 'duty_tax' as const, t: e.importTax }]),
    { stage: 'Warehouse', kind: 'warehouse', t: e.W },
    { stage: 'Warehouse', kind: 'warehouse', t: e.K },
    { stage: 'Delivery to channel', kind: 'delivery', t: e.D },
    { stage: 'Channel', kind: 'marketing', t: e.M },
  ];
  if (e.C.value >= 0) layers.push({ stage: 'Channel', kind: 'contribution', t: e.C });
  else layers.push({ stage: 'Channel', kind: 'loss', t: e.C });
  layers.push({ stage: 'Channel', kind: 'trade', t: e.tradeSpend });
  const marginAmount = calc(
    'channel_margin_amount',
    e.listPrice.value * e.channelMargin.value,
    u,
    'list × channel margin',
    [e.listPrice, e.channelMargin],
    { label: ctx.distributorTier ? 'Distributor margin' : 'Channel margin', meaning: 'Money the channel keeps on each unit.' },
  );
  layers.push({ stage: 'Channel', kind: 'channel_margin', t: marginAmount });
  const exTax = i.shelf_price.value / (1 + i.sales_tax_rate.value);
  if (ctx.distributorTier) {
    layers.push({
      stage: 'Outlet / end user',
      kind: 'retail_margin',
      t: calc('retail_margin_amount', exTax * i.retailer_margin.value, u, 'shelf ÷ (1 + t) × retailer margin', [i.shelf_price, i.sales_tax_rate, i.retailer_margin], {
        label: 'Retailer margin',
        meaning: 'Money the outlet keeps on each unit.',
      }),
    });
  }
  layers.push({
    stage: 'Consumer',
    kind: 'sales_tax',
    t: calc('sales_tax_amount', i.shelf_price.value - exTax, u, 'shelf − shelf ÷ (1 + t)', [i.shelf_price, i.sales_tax_rate], {
      label: 'Sales tax in shelf price',
      meaning: 'VAT / GST / SST the consumer pays inside the shelf price.',
    }),
  });
  return layers;
}
