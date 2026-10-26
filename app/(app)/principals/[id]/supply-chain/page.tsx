import { notFound } from 'next/navigation';
import { Badge, Button, ButtonLink, Card, CardTitle, Empty } from '@/components/ui';
import { Num } from '@/components/num';
import { byId, rows } from '@/lib/db/data';
import { leaf } from '@/lib/calc/traced';
import { redraftAction } from '@/app/actions/principals';

export default async function PrincipalChain({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await byId('principals', id);
  if (!p) notFound();
  const [nodes, lanes, markets] = await Promise.all([rows('sc_nodes'), rows('sc_lanes'), rows('markets')]);
  const mine = nodes.filter((n) => n.principal_id === id);
  const ml = lanes.filter((l) => mine.some((n) => n.id === l.from_node));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/supply-chain?principal=${id}`} variant="primary">Open 3D chain</ButtonLink>
        <form action={redraftAction}><input type="hidden" name="principal_id" value={id} /><Button type="submit" variant="secondary">Re-draft from setup</Button></form>
      </div>
      <Card>
        <CardTitle>Nodes</CardTitle>
        {mine.length ? (
          <ul className="divide-y divide-border text-sm">
            {mine.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{n.name} <span className="text-xs text-muted-foreground">· {markets.find((m) => m.id === n.market_id)?.name ?? 'origin'}</span></span>
                <span className="flex items-center gap-2">
                  <Badge>{n.node_type.replace('_', ' ')}</Badge>
                  {n.lat != null && n.lng != null ? <span className="text-xs text-muted-foreground" title="Kept for the future globe view">📍</span> : null}
                  {n.stock_days != null ? <Num t={leaf('stock_days', Number(n.stock_days), 'days', { tag: 'placeholder', label: `${n.name} stock days` })} /> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No map yet">Add a production site (step 2) and distribution (step 4), then re-draft.</Empty>
        )}
      </Card>
      <Card>
        <CardTitle>Lanes</CardTitle>
        <ul className="divide-y divide-border text-sm">
          {ml.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>{mine.find((n) => n.id === l.from_node)?.name} → {mine.find((n) => n.id === l.to_node)?.name}</span>
              <Badge>{l.mode.replace('_', ' ')}</Badge>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
