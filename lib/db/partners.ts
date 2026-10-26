import 'server-only';
import { judgeAsk, pickBenchmark, type BenchmarkVerdict } from '@/lib/calc/benchmark';
import { leaf, type Traced } from '@/lib/calc/traced';
import type { Partner, PartnerAsk, TermsBenchmark } from './types';

export interface AssessedAsk {
  ask: PartnerAsk;
  t: Traced | null;
  benchmark: TermsBenchmark | undefined;
  verdict: BenchmarkVerdict;
  range: string | null;
}

const METRIC_LABEL: Record<string, string> = {
  gross_margin: 'Gross margin', incentive: 'Incentive', credit_days: 'Credit days', term_months: 'Term (months)', moq: 'Minimum order',
  exclusivity_rule: 'Exclusivity', review_cadence: 'Review cadence',
};
export const metricLabel = (m: string) => METRIC_LABEL[m] ?? m.replace(/_/g, ' ');

function rangeText(b: TermsBenchmark): string {
  const u = b.unit === 'pct' ? '%' : b.unit ? ` ${b.unit}` : '';
  if (b.low != null && b.high != null) return b.low === b.high ? `${b.low}${u}` : `${b.low}–${b.high}${u}`;
  return b.text_value ?? '';
}

export function assessAsks(partner: Partner, asks: PartnerAsk[], benchmarks: TermsBenchmark[]): AssessedAsk[] {
  return asks
    .filter((a) => a.partner_id === partner.id)
    .map((ask) => {
      const role = partner.roles[0] ?? 'distributor';
      const benchmark = pickBenchmark(benchmarks.map((b) => ({ ...b, low: b.low == null ? null : Number(b.low), high: b.high == null ? null : Number(b.high) })), role, ask.metric, partner.market_id) as TermsBenchmark | undefined;
      const verdict = judgeAsk({ metric: ask.metric, value: ask.value == null ? null : Number(ask.value) }, benchmark as never);
      const t =
        ask.value == null
          ? null
          : leaf(`ask_${ask.metric}`, ask.unit === 'pct' ? Number(ask.value) / 100 : Number(ask.value), ask.unit === 'pct' ? '%' : (ask.unit ?? ''), {
              tag: 'quoted',
              label: `${partner.name} ask — ${metricLabel(ask.metric)}`,
              meaning: `What ${partner.name} asked for on ${metricLabel(ask.metric).toLowerCase()}.`,
              source: { label: `${partner.name}${ask.note ? ` — ${ask.note}` : ''}`, asOf: ask.asked_on ?? undefined },
              note: benchmark ? `Benchmark ${rangeText(benchmark)} (${benchmark.source ?? 'no source'})${verdict === 'above' ? ' — ask is ABOVE the benchmark.' : verdict === 'below' ? ' — ask is below the benchmark.' : ''}` : 'No benchmark for this metric.',
            });
      return { ask, t, benchmark, verdict, range: benchmark ? rangeText(benchmark) : null };
    });
}
