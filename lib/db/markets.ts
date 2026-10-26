import 'server-only';
import { marketScore, SCORE_FACTORS, sizeScoreFromPopulation, type ScoreFactor } from '@/lib/calc/score';
import { leaf, type Traced } from '@/lib/calc/traced';
import { tracedFromValue, valueIndex, WORKSPACE_ID } from './data';
import type { Market } from './types';

export async function scoreWeights(): Promise<Record<ScoreFactor, Traced>> {
  const idx = await valueIndex();
  return Object.fromEntries(
    SCORE_FACTORS.map((f) => {
      const v = idx.get('workspace', WORKSPACE_ID, `weight_${f.key}`);
      return [f.key, v ? tracedFromValue(v, idx, `weight_${f.key}`, `Weight of ${f.label} in the market score (Settings).`) : leaf(`weight_${f.key}`, f.defaultWeight, '%', { tag: 'computed', label: `${f.label} weight` })];
    }),
  ) as Record<ScoreFactor, Traced>;
}

export async function marketFactors(m: Market): Promise<{ factors: Partial<Record<ScoreFactor, Traced>>; auto: Partial<Record<ScoreFactor, boolean>> }> {
  const idx = await valueIndex();
  const factors: Partial<Record<ScoreFactor, Traced>> = {};
  const auto: Partial<Record<ScoreFactor, boolean>> = {};
  for (const f of SCORE_FACTORS) {
    const v = idx.get('market', m.id, `score_${f.key}`);
    if (v && v.value_num != null) factors[f.key] = tracedFromValue(v, idx, `score_${f.key}`, `${f.label} factor score (0–100), entered manually with a note.`);
  }
  if (!factors.size) {
    const pop = idx.get('market', m.id, 'population');
    if (pop?.value_num) {
      factors.size = sizeScoreFromPopulation(tracedFromValue(pop, idx));
      auto.size = true;
    }
  }
  return { factors, auto };
}

export async function scoreFor(m: Market): Promise<Traced> {
  const [{ factors }, weights] = await Promise.all([marketFactors(m), scoreWeights()]);
  return marketScore(factors, weights);
}
