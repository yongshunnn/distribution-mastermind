import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, ButtonLink, Card, Empty } from '@/components/ui';
import { Num } from '@/components/num';
import { rows, tracedFromValue, valueIndex } from '@/lib/db/data';
import { principalSetup } from '@/lib/db/principals';

export default async function PrincipalCatalogue({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const setup = await principalSetup(id);
  if (!setup) notFound();
  const [prices, listings, markets, idx] = await Promise.all([rows('sku_prices'), rows('market_listings'), rows('markets'), valueIndex()]);
  if (!setup.skus.length) return <Empty title="No SKUs yet"><Link className="underline" href={`/principals/${id}/setup?step=3`}>Upload the SKU list</Link></Empty>;
  return (
    <div className="space-y-3">
      <div className="flex gap-2"><ButtonLink href="/catalogue">Full catalogue</ButtonLink><ButtonLink href={`/catalogue/import?principal=${id}`} variant="primary">Import SKUs</ButtonLink></div>
      {setup.skus.map((s) => {
        const ps = prices.filter((p) => p.sku_config_id === s.id);
        const ls = listings.filter((l) => l.sku_config_id === s.id);
        return (
          <Card key={s.id}>
            <p className="font-medium">{s.sku_code} <span className="text-sm font-normal text-muted-foreground">{s.name}</span></p>
            <ul className="mt-2 divide-y divide-border text-sm">
              {ps.map((p) => {
                const v = idx.get('sku_price', p.id, 'price');
                return v ? (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1">
                    <span>{p.price_type.replace('_', ' ')} {p.market_id ? `· ${markets.find((m) => m.id === p.market_id)?.iso2}` : ''}</span>
                    <Num t={tracedFromValue(v, idx)} />
                  </li>
                ) : null;
              })}
            </ul>
            {ls.length ? (
              <p className="mt-2 flex flex-wrap gap-1 text-xs">
                {ls.map((l) => <Badge key={l.id}>{markets.find((m) => m.id === l.market_id)?.iso2}: label {l.label_language ?? '—'}{l.label_file_path ? ' ✓ artwork' : ''}</Badge>)}
              </p>
            ) : null}
          </Card>
        );
      })}
    </div>
  );
}
