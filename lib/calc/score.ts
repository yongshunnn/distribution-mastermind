// Market attractiveness score 0–100 (spec §8.6).
import { calc, type Traced } from './traced';

export const SCORE_FACTORS = [
  { key: 'size', label: 'Size', defaultWeight: 0.25 },
  { key: 'access', label: 'Access', defaultWeight: 0.2 },
  { key: 'competition', label: 'Competition', defaultWeight: 0.2 },
  { key: 'right_to_win', label: 'Right to win', defaultWeight: 0.2 },
  { key: 'growth', label: 'Growth', defaultWeight: 0.15 },
] as const;
export type ScoreFactor = (typeof SCORE_FACTORS)[number]['key'];

export function marketScore(factors: Partial<Record<ScoreFactor, Traced>>, weights: Record<ScoreFactor, Traced>): Traced {
  let num = 0;
  let den = 0;
  const parts: Traced[] = [];
  for (const f of SCORE_FACTORS) {
    const s = factors[f.key];
    const w = weights[f.key];
    if (!s || !w) continue;
    num += s.value * w.value;
    den += w.value;
    parts.push(
      calc(`score_${f.key}_weighted`, s.value * w.value, 'score', `${f.label} score × weight`, [s, w], {
        label: `${f.label} (weighted)`,
        meaning: `${f.label} factor score multiplied by its weight.`,
      }),
    );
  }
  const missing = SCORE_FACTORS.filter((f) => !factors[f.key]).map((f) => f.label);
  return calc('market_score', den > 0 ? num / den : 0, 'score', 'Σ weight × factor score ÷ Σ weights', parts, {
    na: den > 0 ? undefined : 'No factor scores entered yet',
    note: missing.length ? `Not scored yet: ${missing.join(', ')}.` : undefined,
  });
}

/** Size factor from population (log-scaled; 1m → ~20, 100m → ~100). Used when no manual score is set. */
export function sizeScoreFromPopulation(pop: Traced): Traced {
  const v = pop.value > 0 ? Math.max(0, Math.min(100, (Math.log10(pop.value) - 5.5) * 40)) : 0;
  return calc('score_size', v, 'score', 'clamp((log10(population) − 5.5) × 40, 0, 100)', [pop], {
    label: 'Size score',
    meaning: 'Market size factor derived from population.',
  });
}
