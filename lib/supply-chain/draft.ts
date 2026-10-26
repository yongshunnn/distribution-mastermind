// Auto-drafts a principal's supply-chain map (sc_nodes + sc_lanes) from production sites and
// the channels it sells through (spec §6: wizard steps 2 and 4). Every node keeps lat/lng for the future globe.
import type { Channel, Market, NodeType, ProductionSite, ScLane, ScNode } from '@/lib/db/types';

type NodeDraft = Omit<ScNode, 'id' | 'created_at' | 'updated_at' | 'created_by'> & { key: string };
type LaneDraft = Omit<ScLane, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'from_node' | 'to_node'> & { from: string; to: string };

export function draftSupplyChain(
  principalId: string,
  sites: ProductionSite[],
  channels: Channel[],
  markets: Market[],
  stockDaysByMarket: Record<string, number> = {},
): { nodes: NodeDraft[]; lanes: LaneDraft[] } {
  const nodes: NodeDraft[] = [];
  const lanes: LaneDraft[] = [];
  const marketById = new Map(markets.map((m) => [m.id, m]));
  const node = (key: string, name: string, node_type: NodeType, market_id: string | null, lat: number | null, lng: number | null, stock_days: number | null = null) => {
    if (!nodes.some((n) => n.key === key)) nodes.push({ key, principal_id: principalId, name, node_type, market_id, lat, lng, stock_days });
    return key;
  };
  const lane = (from: string, to: string, mode: LaneDraft['mode']) => {
    if (!lanes.some((l) => l.from === from && l.to === to))
      lanes.push({ from, to, mode, lead_time_days: null, cost_per_unit: null, cost_per_m3: null, currency: null, payer: null, tag: 'placeholder', source_label: 'Auto-drafted from setup' });
  };
  const site = sites[0];
  if (!site) return { nodes, lanes };
  const factory = node(`factory:${site.id}`, site.name, 'factory', null, site.lat, site.lng);
  const siteMarket = markets.find((m) => m.iso2 === site.country);
  const marketIds = [...new Set(channels.map((c) => c.market_id))];
  for (const mid of marketIds) {
    const m = marketById.get(mid);
    if (!m) continue;
    const domestic = siteMarket?.id === m.id;
    let upstream = factory;
    if (!domestic) {
      const op = node(`origin_port:${site.country}`, `Origin port (${site.country})`, 'origin_port', siteMarket?.id ?? null, site.lat, site.lng);
      lane(factory, op, 'truck');
      const dp = node(`dest_port:${m.iso2}`, `Port of entry (${m.name})`, 'dest_port', m.id, m.lat, m.lng);
      lane(op, dp, site.country && ['SG', 'MY', 'TH'].includes(site.country) && ['SG', 'MY', 'TH'].includes(m.iso2) ? 'truck' : 'sea_fcl');
      upstream = dp;
    }
    const wh = node(`wh:${m.iso2}`, `${m.name} warehouse / 3PL`, '3pl', m.id, m.lat, m.lng, stockDaysByMarket[m.id] ?? null);
    lane(upstream, wh, 'truck');
    for (const c of channels.filter((ch) => ch.market_id === mid)) {
      let from = wh;
      if (c.has_distributor_tier) {
        const dw = node(`dist:${c.id}`, `Distributor for ${c.name}`, 'distributor_wh', m.id, m.lat, m.lng);
        lane(wh, dw, 'truck');
        from = dw;
      }
      const type: NodeType = c.channel_type === 'retail_chain' ? 'retail_dc' : 'outlet';
      const cn = node(`channel:${c.id}`, c.name, type, m.id, m.lat, m.lng);
      lane(from, cn, 'truck');
      const consumer = node(`consumer:${m.iso2}`, `Consumers (${m.name})`, 'consumer', m.id, m.lat, m.lng);
      lane(cn, consumer, 'truck');
    }
  }
  return { nodes, lanes };
}
