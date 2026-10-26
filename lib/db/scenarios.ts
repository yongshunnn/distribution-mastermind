import 'server-only';
import { planScenario, type ScenarioLimits, type ScenarioPlay } from '@/lib/calc/scenario';
import { buildAllPlays, playTitle } from './plays';
import { valueIndex, WORKSPACE_ID } from './data';

export async function runScenario(playIds: string[], limits: ScenarioLimits) {
  const [plays, idx] = await Promise.all([buildAllPlays(), valueIndex()]);
  const defaultPeople = Number(idx.get('workspace', WORKSPACE_ID, 'people_per_play')?.value_num ?? 0.25);
  const chosen = plays.filter((p) => playIds.includes(p.play.id));
  const input: ScenarioPlay[] = chosen.map((p) => {
    const ppl = idx.get('play', p.play.id, 'people');
    const upp = p.inputs.units_per_pallet.value;
    return {
      id: p.play.id,
      name: playTitle(p),
      R: p.econ.R.value,
      contributionMonth: p.sgd.perMonth,
      entryCost: p.sgd.entry,
      peakCash: p.sgd.peakCash,
      people: ppl?.value_num != null ? Number(ppl.value_num) : defaultPeople,
      pallets: upp > 0 ? Math.ceil((p.inputs.q_realistic_month.value * p.inputs.stock_days.value) / (365 / 12) / upp) : 0,
    };
  });
  return { result: planScenario(input, limits), plays: chosen };
}
