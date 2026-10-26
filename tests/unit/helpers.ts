import { judgeAsk, pickBenchmark } from '@/lib/calc/benchmark';
import type { Dataset } from '@/lib/db/types';

export function assessable(d: Dataset, partnerName: string) {
  const p = d.partners.find((x) => x.name === partnerName)!;
  const ask = d.partner_asks.find((a) => a.partner_id === p.id && a.metric === 'gross_margin')!;
  const b = pickBenchmark(d.terms_benchmarks, p.roles[0], 'gross_margin', p.market_id);
  return judgeAsk({ metric: 'gross_margin', value: ask.value }, b);
}
