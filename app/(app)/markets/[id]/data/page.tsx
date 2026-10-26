import { notFound } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui';
import { AddValueForm } from '@/components/forms';
import { ValueTable } from '@/components/value-table';
import { byId, rows, settings, valueIndex } from '@/lib/db/data';

export const metadata = { title: 'Market data' };

export default async function MarketData({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [idx, areas, segments, channels, terms, cfg] = await Promise.all([
    valueIndex(), rows('market_areas'), rows('segments'), rows('channels'), rows('channel_terms'), settings(),
  ]);
  const staleBefore = new Date(Date.now() - cfg.staleDays * 86_400_000).toISOString().slice(0, 10);
  const groups: { title: string; type: string; id: string }[] = [
    { title: `${m.name} — market`, type: 'market', id: m.id },
    ...areas.filter((a) => a.market_id === m.id).map((a) => ({ title: `Area — ${a.name}`, type: 'market_area', id: a.id })),
    ...segments.filter((s) => s.market_id === m.id).map((s) => ({ title: `Segment — ${s.outlet_type}`, type: 'segment', id: s.id })),
    ...channels.filter((c) => c.market_id === m.id).flatMap((c) => [
      { title: `Channel — ${c.name}`, type: 'channel', id: c.id },
      ...terms.filter((t) => t.channel_id === c.id).map((t) => ({ title: `${c.name} terms`, type: 'channel_terms', id: t.id })),
    ]),
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every seeded or entered figure for {m.name}. Tap a value to see its source and history, or edit it — edits are tagged quoted or measured and the
        previous value is kept.
      </p>
      {groups.map((g) => {
        const vals = idx.forEntity(g.type, g.id);
        if (!vals.length && g.type !== 'market') return null;
        return (
          <Card key={`${g.type}:${g.id}`}>
            <CardTitle>{g.title}</CardTitle>
            <ValueTable values={vals} idx={idx} staleBefore={staleBefore} />
            {g.type === 'market' ? <div className="mt-3"><AddValueForm entityType="market" entityId={m.id} /></div> : null}
          </Card>
        );
      })}
    </div>
  );
}
