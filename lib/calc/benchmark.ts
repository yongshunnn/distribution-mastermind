// Partner asks vs terms benchmarks (spec §10).

export interface Benchmark {
  id: string;
  market_id: string | null;
  role: string;
  metric: string;
  low: number | null;
  high: number | null;
  text_value?: string | null;
  unit?: string | null;
  source?: string | null;
}

export interface Ask {
  metric: string;
  value: number | null;
}

export type BenchmarkVerdict = 'below' | 'within' | 'above' | 'no_benchmark';

/** Market-specific benchmark first, then the any-market default. Role matches when the benchmark role contains it. */
export function pickBenchmark(benchmarks: Benchmark[], role: string, metric: string, marketId: string | null): Benchmark | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const roleMatch = (b: Benchmark) => norm(b.role).includes(norm(role)) || norm(role).includes(norm(b.role)) || b.role.toLowerCase() === 'any';
  const numeric = benchmarks.filter((b) => b.metric === metric && roleMatch(b) && (b.low != null || b.high != null));
  return numeric.find((b) => marketId && b.market_id === marketId) ?? numeric.find((b) => b.market_id === null);
}

export function judgeAsk(ask: Ask, b: Benchmark | undefined): BenchmarkVerdict {
  if (!b || ask.value == null) return 'no_benchmark';
  if (b.low != null && ask.value < b.low) return 'below';
  if (b.high != null && ask.value > b.high) return 'above';
  return 'within';
}
