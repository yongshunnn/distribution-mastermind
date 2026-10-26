import Link from 'next/link';
import { Badge, ButtonLink, Card, Empty, PageHeader } from '@/components/ui';
import { Num } from '@/components/num';
import { rows } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';

export const metadata = { title: 'Plays' };

export default async function PlaysPage({ searchParams }: { searchParams: Promise<{ principal?: string; market?: string; channel?: string; sort?: string }> }) {
  const sp = await searchParams;
  const [plays, markets, principals, channels, notes] = await Promise.all([buildAllPlays(), rows('markets'), rows('principals'), rows('channels'), rows('market_watch_notes')]);
  const flagged = new Set(notes.flatMap((n) => n.flags.play_ids ?? []));
  const shown = plays
    .filter((p) => (!sp.market || p.market.id === sp.market) && (!sp.principal || p.principalId === sp.principal) && (!sp.channel || p.channel.id === sp.channel))
    .sort((a, b) => (sp.sort === 'contribution' ? b.sgd.perMonth - a.sgd.perMonth : b.econ.R.value - a.econ.R.value));
  const sel = 'min-h-11 rounded-lg border border-border bg-card px-3 text-sm';
  return (
    <div className="space-y-4">
      <PageHeader
        title="Plays"
        subtitle="SKU × channel × segment × market, ranked by return on cash (R)."
        actions={<ButtonLink href="/plays/new" variant="primary">New play</ButtonLink>}
      />
      <form method="get" className="flex flex-wrap gap-2">
        <select name="principal" defaultValue={sp.principal ?? ''} className={sel} aria-label="Principal">
          <option value="">All principals</option>
          {principals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="market" defaultValue={sp.market ?? ''} className={sel} aria-label="Market">
          <option value="">All markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select name="channel" defaultValue={sp.channel ?? ''} className={sel} aria-label="Channel">
          <option value="">All channels</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="sort" defaultValue={sp.sort ?? 'r'} className={sel} aria-label="Sort">
          <option value="r">Sort: return on cash</option>
          <option value="contribution">Sort: monthly contribution</option>
        </select>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm">Apply</button>
      </form>
      {shown.length ? (
        <ol className="space-y-3">
          {shown.map((p, i) => (
            <li key={p.play.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">#{i + 1} · {p.market.name} · {p.segment?.outlet_type ?? 'all segments'}</p>
                    <Link href={`/plays/${p.play.id}`} className="font-semibold hover:underline">{playTitle(p)}</Link>
                  </div>
                  <span className="flex flex-wrap gap-1">
                    <Badge>{p.play.status}</Badge>
                    {p.econ.C.value < 0 ? <Badge tone="danger">Loses money</Badge> : null}
                    {p.econ.valueDensityLow ? <Badge tone="warn">Low value density</Badge> : null}
                    {flagged.has(p.play.id) ? <Badge tone="warn">Watch note</Badge> : null}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Return on cash</dt><dd><Num t={p.econ.R} size="lg" /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Contribution / unit</dt><dd><Num t={p.econ.C} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Per month</dt><dd><Num t={p.econ.perMonth} /></dd></div>
                  <div><dt className="text-xs text-muted-foreground">Break-even</dt><dd><Num t={p.econ.breakeven} /></dd></div>
                </dl>
              </Card>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title="No plays match" />
      )}
    </div>
  );
}
