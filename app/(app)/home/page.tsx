import Link from 'next/link';
import { Card, CardTitle, Empty, PageHeader, Badge } from '@/components/ui';
import { Num } from '@/components/num';
import { portfolio } from '@/lib/db/portfolio';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { STAGE_NAMES, STATUS_LABEL } from '@/lib/stages';

export const metadata = { title: 'Home' };

export default async function HomePage() {
  const [p, markets, segments, channels, areas, terms, idx] = await Promise.all([
    portfolio(), rows('markets'), rows('segments'), rows('channels'), rows('market_areas'), rows('channel_terms'), valueIndex(),
  ]);
  const marketOf = (entityType: string, id: string): string | undefined => {
    if (entityType === 'market') return id;
    if (entityType === 'segment') return segments.find((s) => s.id === id)?.market_id;
    if (entityType === 'channel') return channels.find((c) => c.id === id)?.market_id;
    if (entityType === 'market_area') return areas.find((a) => a.id === id)?.market_id;
    if (entityType === 'channel_terms') return channels.find((c) => c.id === terms.find((t) => t.id === id)?.channel_id)?.market_id;
    return undefined;
  };
  const maxMarket = Math.max(1, ...p.byMarket.map((m) => Math.abs(m.t.value)));
  const stages = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="space-y-4">
      <PageHeader title="Portfolio" subtitle="One-glance state of every play, market and principal." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-muted-foreground">Monthly contribution, all plays</p>
          <Num t={p.total} size="xl" />
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Values still placeholder</p>
          <Num t={p.placeholderCount} size="xl" />
          <p className="mt-1 text-xs text-muted-foreground">Grey dot = placeholder. Replace with quotes.</p>
        </Card>
        <Card>
          <p className="text-xs text-muted-foreground">Stale public / estimated figures</p>
          <Num t={p.staleCount} size="xl" />
          <p className="mt-1 text-xs text-muted-foreground">Older than {p.staleDays} days.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Contribution by market</CardTitle>
          {p.byMarket.length ? (
            <ul className="space-y-3">
              {p.byMarket.map(({ market, t }) => (
                <li key={market.id}>
                  <div className="flex items-baseline justify-between gap-2">
                    <Link href={`/markets/${market.id}`} className="text-sm font-medium hover:underline">
                      {market.name}
                    </Link>
                    <Num t={t} />
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                    <div
                      className={`h-2 rounded-full ${t.value < 0 ? 'bg-danger' : 'bg-primary'}`}
                      style={{ width: `${Math.max(3, (Math.abs(t.value) / maxMarket) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No plays yet" />
          )}
        </Card>
        <Card>
          <CardTitle>Contribution by principal</CardTitle>
          <ul className="space-y-2">
            {p.byPrincipal.map(({ principal, t }) => (
              <li key={principal.id} className="flex items-baseline justify-between gap-2">
                <Link href={`/principals/${principal.id}`} className="text-sm font-medium hover:underline">
                  {principal.name}
                </Link>
                <Num t={t} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Built from <Link href="/plays" className="underline">plays</Link> at realistic volume. Tap any number for its breakdown.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Pipeline — markets by stage</CardTitle>
        <div className="-mx-4 overflow-x-auto px-4" data-testid="pipeline-board">
          <ol className="flex min-w-max gap-3">
            {stages.map((s) => {
              const cards = p.board.filter((b) => b.stage === s);
              return (
                <li key={s} className="w-44 shrink-0 rounded-lg bg-muted p-2">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">
                    {s <= 7 ? `${s} · ${STAGE_NAMES[s]}` : 'All gates passed'}
                  </p>
                  <ul className="space-y-2">
                    {cards.map((b) => (
                      <li key={b.tracker.id}>
                        <Link href={`/markets/${b.market.id}/stages?tracker=${b.tracker.id}`} className="block rounded-lg border border-border bg-card p-2 text-sm hover:border-primary">
                          <span className="block font-medium">{b.market.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {b.principal.name}
                            {b.tracker.kind === 'expansion' ? ` · ${b.tracker.scope ?? 'expansion'}` : ''}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {b.market.status === 'paused' ? <Badge tone="warn">Paused</Badge> : null}
                            {b.blocked.value ? <Badge tone="danger">Blocked</Badge> : null}
                            {b.overdue.value ? <Badge tone="warn">Overdue</Badge> : null}
                          </span>
                        </Link>
                        {b.blocked.value || b.overdue.value ? (
                          <p className="mt-1 flex gap-2 px-1 text-xs text-muted-foreground">
                            {b.blocked.value ? <span>blocked <Num t={b.blocked} /></span> : null}
                            {b.overdue.value ? <span>overdue <Num t={b.overdue} /></span> : null}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Blocked and overdue checklist items</CardTitle>
          {p.board.some((b) => b.blockedItems.length || b.overdueItems.length) ? (
            <ul className="divide-y divide-border">
              {p.board.flatMap((b) =>
                [...b.blockedItems, ...b.overdueItems.filter((o) => !b.blockedItems.includes(o))].map((i) => (
                  <li key={i.id} className="py-2">
                    <Link href={`/markets/${b.market.id}/stages?tracker=${b.tracker.id}#item-${i.id}`} className="block min-h-11 hover:underline">
                      <span className="text-sm font-medium">{i.item}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.market.name} · stage {i.stage_no} · {STATUS_LABEL[i.status]}
                        {i.due_date ? ` · due ${i.due_date}` : ''}
                      </span>
                    </Link>
                  </li>
                )),
              )}
            </ul>
          ) : (
            <Empty title="Nothing blocked or overdue" />
          )}
        </Card>
        <Card>
          <CardTitle>Stale-data warnings</CardTitle>
          {p.stale.length ? (
            <ul className="divide-y divide-border">
              {p.stale.slice(0, 8).map((v) => {
                const mid = marketOf(v.entity_type, v.entity_id);
                const m = markets.find((x) => x.id === mid);
                return (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 text-sm">
                      {m ? (
                        <Link href={`/markets/${m.id}/data`} className="hover:underline">
                          {v.label ?? v.field}
                        </Link>
                      ) : (
                        (v.label ?? v.field)
                      )}
                      <span className="block text-xs text-muted-foreground">
                        {m?.name ?? v.entity_type} · as of {v.as_of}
                      </span>
                    </span>
                    {v.value_num != null ? <Num t={{ ...tracedFromValue(v, idx), stale: true }} /> : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <Empty title="All seed figures are fresh" />
          )}
          {p.stale.length > 8 ? (
            <p className="mt-2 text-xs text-muted-foreground">Showing 8 of the stale figures — see each market&apos;s Data tab for all.</p>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
