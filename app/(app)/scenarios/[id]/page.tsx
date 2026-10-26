import { notFound } from 'next/navigation';
import { Badge, Button, Card, CardTitle, PageHeader } from '@/components/ui';
import { Disclosure } from '@/components/forms';
import { Num } from '@/components/num';
import { byId } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';
import { runScenario } from '@/lib/db/scenarios';
import { calc, leaf } from '@/lib/calc/traced';
import { deleteScenario } from '@/app/actions/scenarios';
import { ScenarioForm } from '@/components/scenario-form';

export const metadata = { title: 'Scenario' };

export default async function ScenarioDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await byId('scenarios', id);
  if (!s) notFound();
  const [{ result, plays }, all] = await Promise.all([runScenario(s.play_ids, s.limits), buildAllPlays()]);
  const byPlay = new Map(plays.map((p) => [p.play.id, p]));
  const included = result.plan.filter((r) => r.included);
  const parts = included.map((r) => byPlay.get(r.id)!.econ.perMonth);
  const cm = calc('contribution_per_month', result.totals.contributionMonth, 'SGD/month', 'Σ included plays (→ SGD)', parts, { label: 'Planned contribution / month' });
  const entryParts = included.map((r) => byPlay.get(r.id)!.inputs.entry_cost);
  const cashParts = included.map((r) => byPlay.get(r.id)!.econ.peakCash);
  const funding = calc('funding_need', result.fundingNeed, 'SGD', 'deepest point of cumulative cash (entry + working capital − monthly contribution)', [...entryParts, ...cashParts, ...parts], {
    label: 'Peak funding need', meaning: 'The most cash the plan needs before contribution pays it back.',
  });
  const limit = (k: keyof typeof s.limits, label: string, unit: string) =>
    s.limits[k] != null ? <span className="text-sm">{label} <Num t={leaf(`limit_${k}`, Number(s.limits[k]), unit, { tag: 'computed', label, meaning: 'Limit set on this scenario.' })} /></span> : null;

  return (
    <div className="space-y-4">
      <PageHeader back={{ href: '/scenarios', label: 'Scenarios' }} title={s.name} subtitle={<span className="flex flex-wrap gap-3">{limit('capital', 'Capital', 'SGD')}{limit('wc_limit', 'WC', 'SGD')}{limit('people', 'People', 'FTE')}{limit('pallets', 'Pallets', 'pallets')}</span>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-xs text-muted-foreground">Planned contribution</p><Num t={cm} size="xl" /></Card>
        <Card><p className="text-xs text-muted-foreground">Peak funding need</p><Num t={funding} size="xl" /></Card>
        <Card><p className="text-xs text-muted-foreground">Plays in plan</p><Num t={{ ...leaf('plays_in_plan', included.length, 'count', { tag: 'computed', label: 'Plays in plan', meaning: 'Plays that fit every limit, taken in order of return on cash.' }) }} size="xl" /></Card>
      </div>
      <Card>
        <CardTitle>Ranked plan (by return on cash)</CardTitle>
        <ol className="divide-y divide-border">
          {result.plan.map((r) => {
            const b = byPlay.get(r.id)!;
            return (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-included={r.included}>
                <span className="min-w-0 text-sm">
                  #{r.rank} {playTitle(b)} <span className="text-xs text-muted-foreground">· {b.market.name}</span>
                  <span className="block">{r.included ? <Badge tone="ok">In plan</Badge> : <Badge tone="danger">{r.reason}</Badge>}</span>
                </span>
                <span className="flex flex-wrap gap-3 text-sm"><Num t={b.econ.R} /><Num t={b.econ.perMonth} /><Num t={b.econ.peakCash} /></span>
              </li>
            );
          })}
        </ol>
      </Card>
      <Card className="overflow-x-auto">
        <CardTitle>Monthly cash need (SGD)</CardTitle>
        <table className="w-full min-w-[22rem] text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1">Month</th><th>Net cash</th><th>Cumulative</th></tr></thead>
          <tbody>
            {result.monthly.map((m) => (
              <tr key={m.month} className="border-t border-border">
                <td className="py-1">{m.month}</td>
                <td><Num t={calc('month_net_cash', m.net, 'SGD', m.month === 1 ? '− entry cost − working capital + contribution' : 'contribution', parts, { label: `Month ${m.month} net cash` })} /></td>
                <td><Num t={calc('month_cum_cash', m.cumulative, 'SGD', 'running total', parts, { label: `Month ${m.month} cumulative cash` })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Disclosure summary="Edit scenario">
        <ScenarioForm plays={all.map((p) => ({ id: p.play.id, label: `${playTitle(p)} · ${p.market.name}` }))} initial={{ id: s.id, name: s.name, play_ids: s.play_ids, limits: s.limits }} />
      </Disclosure>
      <form action={deleteScenario}><input type="hidden" name="id" value={s.id} /><Button variant="ghost" type="submit">Delete scenario</Button></form>
    </div>
  );
}
