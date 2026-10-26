import { PageHeader } from '@/components/ui';
import { SupplyChainView } from '@/components/supply-chain-3d/view';
import type { Branch } from '@/components/supply-chain-3d/types';
import { rows } from '@/lib/db/data';
import { buildAllPlays, playTitle } from '@/lib/db/plays';

export const metadata = { title: 'Supply chain' };

const OVERLAND = ['SG', 'MY', 'TH'];

/** Same rule as the supply-chain drafter: domestic or overland neighbours by truck, otherwise sea freight. */
function freightMode(origin: string, dest: string): Branch['freight'] {
  if (origin === dest || (OVERLAND.includes(origin) && OVERLAND.includes(dest))) return 'truck';
  return 'ship';
}

export default async function SupplyChainPage({ searchParams }: { searchParams: Promise<{ principal?: string; sku?: string; market?: string; play?: string }> }) {
  const sp = await searchParams;
  const [plays, principals, markets, skus, sites] = await Promise.all([buildAllPlays(), rows('principals'), rows('markets'), rows('sku_configs'), rows('production_sites')]);
  const focus = plays.find((p) => p.play.id === sp.play);
  const principalId = sp.principal ?? focus?.principalId ?? principals[0]?.id;
  const marketId = sp.market ?? focus?.market.id ?? markets.find((m) => m.iso2 === 'SG')?.id ?? '';
  const chosen = plays.filter(
    (p) => p.principalId === principalId && (marketId === 'all' || p.market.id === marketId) && (!sp.sku || p.sku.id === sp.sku),
  );
  const branches: Branch[] = chosen.map((p) => ({
    id: p.play.id, title: playTitle(p), market: p.market.name, channel: p.channel.name, inputs: p.inputs, ctx: p.ctx,
    unitsPerCarton: p.unitsPerCarton, sizeLitres: p.sizeLitres,
    freight: freightMode((p.play.assumption_overrides.origin_iso2 as string) ?? sites.find((s) => s.principal_id === p.principalId)?.country ?? p.market.iso2, p.market.iso2),
    channelType: p.channel.channel_type,
    outletKind: /food|hawker|f&b|stall|restaurant|catering|beverage|hotel/i.test(p.segment?.outlet_type ?? '') ? 'food' : 'shop',
  }));
  const sel = 'min-h-11 rounded-lg border border-border bg-card px-3 text-sm';
  return (
    <div className="space-y-4">
      <PageHeader title="Supply chain" subtitle="Factory to consumer: per-unit cost layers stack stage by stage up to the shelf price. One branch per channel. Tap anything for its explanation." />
      <form method="get" className="flex flex-wrap gap-2">
        <select name="principal" defaultValue={principalId} className={sel} aria-label="Principal">
          {principals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="market" defaultValue={marketId} className={sel} aria-label="Market">
          <option value="all">All markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select name="sku" defaultValue={sp.sku ?? ''} className={sel} aria-label="SKU configuration">
          <option value="">All SKUs</option>
          {skus.map((s) => <option key={s.id} value={s.id}>{s.sku_code}</option>)}
        </select>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm">Show</button>
      </form>
      <SupplyChainView branches={branches} />
    </div>
  );
}
