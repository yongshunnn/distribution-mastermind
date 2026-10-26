import 'server-only';
import { cache } from 'react';
import { calc, count, type Traced } from '@/lib/calc/traced';
import { currentStage, isOverdue } from '@/lib/stages';
import { buildAllPlays, playTitle, type BuiltPlay } from './plays';
import { rows, settings, valueIndex } from './data';

/** Sum of plays' monthly contribution in SGD, grouped. Each part is the play's own traced number. */
export function sgdContribution(plays: BuiltPlay[], label: string): Traced {
  const parts = plays.map((p) => {
    const t = p.econ.perMonth;
    return calc('contribution_per_month', p.sgd.perMonth, 'SGD/month', t.alt ? `${t.unit.split('/')[0]} → SGD at latest FX` : t.formula ?? 'C × Q', [t], {
      label: playTitle(p),
    });
  });
  return calc('contribution_per_month', parts.reduce((s, x) => s + x.value, 0), 'SGD/month', 'Σ play contribution per month (in SGD)', parts, {
    label,
    meaning: `Monthly contribution of ${label.toLowerCase()} at realistic volumes, converted to SGD.`,
  });
}

export const portfolio = cache(async () => {
  const [plays, markets, principals, trackers, items, overrides, cfg, idx] = await Promise.all([
    buildAllPlays(), rows('markets'), rows('principals'), rows('stage_trackers'), rows('stage_items'), rows('gate_overrides'), settings(), valueIndex(),
  ]);
  const active = plays.filter((p) => p.play.status !== 'archived');
  const byMarket = markets.map((m) => ({ market: m, t: sgdContribution(active.filter((p) => p.market.id === m.id), m.name) })).filter((x) => x.t.components?.length);
  const byPrincipal = principals.map((pr) => ({ principal: pr, t: sgdContribution(active.filter((p) => p.principalId === pr.id), pr.name) })).filter((x) => x.t.components?.length);
  const total = sgdContribution(active, 'All plays');

  const today = new Date();
  const board = trackers.map((tr) => {
    const its = items.filter((i) => i.tracker_id === tr.id);
    const ovs = overrides.filter((o) => o.tracker_id === tr.id);
    const blocked = its.filter((i) => i.status === 'blocked');
    const overdue = its.filter((i) => isOverdue(i, today));
    return {
      tracker: tr,
      market: markets.find((m) => m.id === tr.market_id)!,
      principal: principals.find((p) => p.id === tr.principal_id)!,
      stage: currentStage(its, ovs, tr.kind === 'expansion' ? Math.min(...its.map((i) => i.stage_no)) : 1),
      blocked: count('blocked_items', blocked.length, 'Blocked items', 'Checklist items marked blocked in this tracker.'),
      overdue: count('overdue_items', overdue.length, 'Overdue items', 'Open checklist items past their due date.'),
      blockedItems: blocked,
      overdueItems: overdue,
    };
  });

  const staleCutoff = new Date(today.getTime() - cfg.staleDays * 86_400_000).toISOString().slice(0, 10);
  const stale = [...idx.current.values()].filter((v) => v.as_of && v.as_of < staleCutoff && v.tag !== 'measured' && v.tag !== 'quoted');
  const placeholders = [...idx.current.values()].filter((v) => v.tag === 'placeholder');
  return {
    plays: active,
    total,
    byMarket,
    byPrincipal,
    board,
    stale,
    staleCount: count('stale_values', stale.length, 'Stale seed values', `Public or estimated figures older than ${cfg.staleDays} days (threshold in Settings).`),
    placeholderCount: count('placeholder_values', placeholders.length, 'Placeholders', 'Values still tagged placeholder — replace them with quotes or measurements.'),
    staleDays: cfg.staleDays,
  };
});
