// Scenario planning under limits (spec §4 Scenarios, milestone 8).
import { calc, type Traced } from './traced';

export interface ScenarioPlay {
  id: string;
  name: string;
  R: number;
  contributionMonth: number; // in base currency
  entryCost: number;
  peakCash: number;
  people: number;
  pallets: number;
}

export interface ScenarioLimits {
  capital?: number | null;    // cap on entry cost + working capital
  wc_limit?: number | null;   // cap on peak working capital
  people?: number | null;
  pallets?: number | null;
}

export interface PlanRow extends ScenarioPlay {
  rank: number;
  included: boolean;
  reason?: string;
}

export interface ScenarioResult {
  plan: PlanRow[];
  monthly: { month: number; net: number; cumulative: number }[];
  fundingNeed: number;
  totals: { entry: number; peakCash: number; people: number; pallets: number; contributionMonth: number };
}

/** Greedy by return on cash: take plays in R order while every limit still holds. */
export function planScenario(plays: ScenarioPlay[], limits: ScenarioLimits, months = 12): ScenarioResult {
  const sorted = [...plays].sort((a, b) => b.R - a.R);
  const totals = { entry: 0, peakCash: 0, people: 0, pallets: 0, contributionMonth: 0 };
  const plan: PlanRow[] = sorted.map((p, idx) => {
    const row: PlanRow = { ...p, rank: idx + 1, included: false };
    if (p.contributionMonth <= 0) return { ...row, reason: 'Negative contribution' };
    const next = {
      entry: totals.entry + p.entryCost,
      peakCash: totals.peakCash + p.peakCash,
      people: totals.people + p.people,
      pallets: totals.pallets + p.pallets,
    };
    if (limits.capital != null && next.entry + next.peakCash > limits.capital) return { ...row, reason: 'Over capital limit' };
    if (limits.wc_limit != null && next.peakCash > limits.wc_limit) return { ...row, reason: 'Over working-capital limit' };
    if (limits.people != null && next.people > limits.people) return { ...row, reason: 'Not enough people' };
    if (limits.pallets != null && next.pallets > limits.pallets) return { ...row, reason: 'Not enough warehouse space' };
    Object.assign(totals, next);
    totals.contributionMonth += p.contributionMonth;
    return { ...row, included: true };
  });
  const monthly: ScenarioResult['monthly'] = [];
  let cum = 0;
  for (let m = 1; m <= months; m++) {
    const net = (m === 1 ? -(totals.entry + totals.peakCash) : 0) + totals.contributionMonth;
    cum += net;
    monthly.push({ month: m, net, cumulative: cum });
  }
  const fundingNeed = Math.max(0, -Math.min(0, ...monthly.map((x) => x.cumulative)));
  return { plan, monthly, fundingNeed, totals };
}

export function tracedTotal(key: string, label: string, value: number, unit: string, parts: Traced[], formula: string): Traced {
  return calc(key, value, unit, formula, parts, { label, meaning: label });
}
