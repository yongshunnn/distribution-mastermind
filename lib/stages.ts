// Stage-gate logic (spec §9). Pure: used by server pages and tests.
import type { GateOverride, StageItem } from '@/lib/db/types';

export const STAGE_NAMES: Record<number, string> = {
  1: 'Screen', 2: 'Validate', 3: 'Route & partners', 4: 'Compliance & setup', 5: 'Agreement', 6: 'First order', 7: 'Review',
};

export const STATUS_LABEL: Record<StageItem['status'], string> = {
  not_started: 'Not started', in_progress: 'In progress', done: 'Done', not_needed: 'Not needed', blocked: 'Blocked',
};

const closed = (s: StageItem['status']) => s === 'done' || s === 'not_needed';

export interface GateState {
  stage: number;
  openRequired: StageItem[];
  passed: boolean;
  overridden: GateOverride | undefined;
  blocked: number;
  done: number;
  total: number;
}

export function gateStates(items: StageItem[], overrides: GateOverride[]): GateState[] {
  return [1, 2, 3, 4, 5, 6, 7].map((stage) => {
    const its = items.filter((i) => i.stage_no === stage);
    const openRequired = its.filter((i) => i.required && !closed(i.status));
    const overridden = overrides.find((o) => o.stage_no === stage);
    return {
      stage,
      openRequired,
      passed: openRequired.length === 0 || Boolean(overridden),
      overridden,
      blocked: its.filter((i) => i.status === 'blocked').length,
      done: its.filter((i) => closed(i.status)).length,
      total: its.length,
    };
  });
}

/** Current stage = first stage whose gate has not been passed (8 = all passed). */
export function currentStage(items: StageItem[], overrides: GateOverride[], startStage = 1): number {
  const g = gateStates(items, overrides).filter((s) => s.stage >= startStage);
  return g.find((s) => !s.passed)?.stage ?? 8;
}

export function isOverdue(i: StageItem, today = new Date()): boolean {
  return Boolean(i.due_date && !closed(i.status) && new Date(i.due_date) < new Date(today.toISOString().slice(0, 10)));
}
