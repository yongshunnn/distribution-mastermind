// Principal P&L under trade-services fee models (spec §8.8).
import { calc, constant, type Traced } from './traced';

export interface FeeTerm {
  id: string;
  model: 'retainer' | 'commission' | 'profit_share';
  /** retainer: currency per month. commission / profit_share: fraction (0.03 = 3%). */
  amount: Traced;
  basis?: string | null;
}

export interface FeeMonth {
  month: number;
  retainer: number;
  commission: number;
  profitShare: number;
  cumulativeNpat: number;
  paidBack: boolean;
}

export interface FeeResult {
  months: FeeMonth[];
  total: Traced;
  byModel: Traced[];
  paybackMonth: number | null;
}

/**
 * Simulates `months` months. Profit share applies only once the principal's cumulative market NPAT
 * has repaid its investment, and then only on NPAT above the payback point.
 */
export function principalFees(
  terms: FeeTerm[],
  netSalesMonthly: Traced,
  npatMonthly: Traced,
  investment: Traced,
  currency: string,
  months = 12,
): FeeResult {
  const rows: FeeMonth[] = [];
  let cumulative = 0;
  let paybackMonth: number | null = null;
  const retainer = terms.filter((t) => t.model === 'retainer').reduce((s, t) => s + t.amount.value, 0);
  const commissionPct = terms.filter((t) => t.model === 'commission').reduce((s, t) => s + t.amount.value, 0);
  const sharePct = terms.filter((t) => t.model === 'profit_share').reduce((s, t) => s + t.amount.value, 0);
  for (let m = 1; m <= months; m++) {
    const before = cumulative;
    cumulative += npatMonthly.value;
    const shareable = Math.max(0, cumulative - Math.max(investment.value, before));
    const paidBack = cumulative >= investment.value;
    if (paidBack && paybackMonth === null) paybackMonth = m;
    rows.push({
      month: m,
      retainer,
      commission: commissionPct * netSalesMonthly.value,
      profitShare: paidBack ? sharePct * Math.min(shareable, Math.max(0, npatMonthly.value)) : 0,
      cumulativeNpat: cumulative,
      paidBack,
    });
  }
  const n = constant('months', months, 'months', 'Months simulated');
  const byModel: Traced[] = [];
  const retainerTerms = terms.filter((t) => t.model === 'retainer');
  if (retainerTerms.length)
    byModel.push(calc('fee_retainer', retainer * months, currency, 'monthly retainer × months', [...retainerTerms.map((t) => t.amount), n], { label: 'Retainer', meaning: 'Fixed monthly fee.' }));
  const commissionTerms = terms.filter((t) => t.model === 'commission');
  if (commissionTerms.length)
    byModel.push(calc('fee_commission', rows.reduce((s, r) => s + r.commission, 0), currency, 'commission % × principal net sales × months', [...commissionTerms.map((t) => t.amount), netSalesMonthly, n], { label: 'Commission', meaning: 'Share of principal net sales in the market.' }));
  const shareTerms = terms.filter((t) => t.model === 'profit_share');
  if (shareTerms.length)
    byModel.push(calc('fee_profit_share', rows.reduce((s, r) => s + r.profitShare, 0), currency, 'profit share % × market NPAT after payback', [...shareTerms.map((t) => t.amount), npatMonthly, investment, n], { label: 'Profit share', meaning: 'Share of market NPAT once the principal has recovered its investment.' }));
  const total = calc('fee_income', byModel.reduce((s, b) => s + b.value, 0), currency, byModel.map((b) => b.label).join(' + ') || 'no fee terms', byModel, {
    label: `Fee income (${months} months)`,
  });
  return { months: rows, total, byModel, paybackMonth };
}
