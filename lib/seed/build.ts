// Turns the JSON files in /seed into table rows with stable ids (spec §12).
// Used by the in-memory demo store and by scripts/seed.ts / scripts/gen-seed-sql.ts.
import glossary from '@/seed/glossary.json';
import singapore from '@/seed/singapore.json';
import malaysia from '@/seed/malaysia.json';
import myanmar from '@/seed/myanmar.json';
import sgKeon from '@/seed/sg_keon.json';
import partnerRoles from '@/seed/partner_roles.json';
import benchmarks from '@/seed/terms_benchmarks.json';
import stageTemplates from '@/seed/stage_templates.json';
import workspace from '@/seed/workspace.json';
import type { Tag } from '@/lib/calc/traced';
import { draftSupplyChain } from '@/lib/supply-chain/draft';
import { TABLE_ORDER, type Dataset, type ItemStatus, type Market, type RouteType, type TableName } from '@/lib/db/types';
import { seedId, WORKSPACE_ID } from './ids';

export const SEED_TIME = '2026-10-26T00:00:00.000Z';

type ValueSeed = {
  field: string;
  label?: string;
  value_num?: number | null;
  value_text?: string;
  unit?: string;
  tag: string;
  source_label?: string;
  source_url?: string;
  as_of?: string;
  note?: string;
};

type MarketSeed = {
  market: { name: string; iso2: string; currency: string; vat_name: string; status: string; lat: number; lng: number; blocker?: string; alt_routes?: string[] };
  values: ValueSeed[];
  areas?: { key: string; name: string; values: ValueSeed[] }[];
  segments: { key: string; outlet_type: string; values: ValueSeed[] }[];
  channels: { key: string; name: string; channel_type: string; segments: string[]; distributor_tier: boolean; delivery_mode?: string; notes?: string; terms: ValueSeed[]; values?: ValueSeed[] }[];
  trade_rules: { hs_code: string; origin_iso2: string | null; regime: string; coo_form: string | null; duty_pct: number; tag: string; source: string; source_url?: string; note?: string }[];
  compliance_gates: { requirement: string; detail?: string; authority?: string | null; tag: string; status?: string; source?: string | null; source_url?: string }[];
  competitors: { brand: string; owner: string; pack_sizes: string[]; positioning: string; structural_strength: string; weakness: string; how_we_win: string }[];
  partners: { name: string; roles: string[]; reach?: string; notes?: string; deal_stage?: string; asks?: { metric: string; value?: number; value_text?: string; unit?: string; note?: string }[] }[];
  evidence: { statement: string; value?: string; tag: string; source?: string; source_url?: string; as_of?: string }[];
  tracker: null | {
    principal: string;
    default_note?: string;
    statuses: Record<string, string>;
    notes?: Record<string, string>;
    extra_items: { stage_no: number; item: string; required: boolean; status: string; note?: string; watch_out?: string }[];
  };
  watchouts?: { text: string; stage_no: number; category: string }[];
};

const MARKETS = [singapore, malaysia, myanmar] as unknown as MarketSeed[];

function base(id: string) {
  return { id, created_at: SEED_TIME, updated_at: SEED_TIME, created_by: null };
}

export function buildSeed(): Dataset {
  const d = Object.fromEntries(TABLE_ORDER.map((t) => [t, []])) as unknown as Dataset;
  const tv = (entity_type: string, entity_id: string, v: ValueSeed) => {
    d.tracked_values.push({
      ...base(seedId(`tv:${entity_type}:${entity_id}:${v.field}`)),
      entity_type,
      entity_id,
      field: v.field,
      label: v.label ?? null,
      value_num: v.value_num ?? null,
      value_text: v.value_text ?? null,
      unit: v.unit ?? null,
      tag: v.tag as Tag,
      source_label: v.source_label ?? null,
      source_url: v.source_url ?? null,
      as_of: v.as_of ?? null,
      note: v.note ?? null,
      is_current: true,
      replaced_by: null,
    });
  };

  // Workspace
  for (const u of workspace.allowed_users) d.allowed_users.push({ ...u, created_at: SEED_TIME });
  for (const [key, value] of Object.entries(workspace.settings)) d.settings.push({ key, value, updated_at: SEED_TIME });
  for (const v of workspace.values) tv('workspace', WORKSPACE_ID, v as ValueSeed);
  for (const r of workspace.fx_rates) d.fx_rates.push({ ...base(seedId(`fx:${r.base}:${r.quote}:${r.month}`)), ...r, tag: r.tag as Tag });
  for (const g of glossary) d.glossary.push({ ...base(seedId(`glossary:${g.key}`)), key: g.key, label: g.label, meaning: g.meaning, formula_text: g.formula_text ?? null, unit: g.unit ?? null });
  for (const r of partnerRoles) d.partner_roles.push({ ...base(seedId(`role:${r.role}`)), ...r, role: r.role as RouteType });
  for (const s of stageTemplates.stages) d.stage_templates.push({ ...base(seedId(`stage:${s.stage_no}`)), ...s });
  stageTemplates.items.forEach((it, i) => d.stage_items_template.push({ ...base(seedId(`stage_item_tpl:${it.stage_no}:${it.item}`)), ...it, sort: i }));

  // Principal SG KEON
  const pid = seedId(`principal:${sgKeon.key}`);
  d.principals.push({ ...base(pid), ...sgKeon.principal, contract_type: null, exclusivity: null });
  const bid = seedId(`brand:${sgKeon.key}`);
  d.brands.push({ ...base(bid), principal_id: pid, ...sgKeon.brand });
  for (const s of sgKeon.sites) d.production_sites.push({ ...base(seedId(`site:${s.name}`)), principal_id: pid, ...s });

  // Markets
  const marketIds: Record<string, string> = {};
  const channelIds: Record<string, string> = {};
  const segmentIds: Record<string, string> = {};
  for (const ms of MARKETS) {
    const mid = seedId(`market:${ms.market.iso2}`);
    marketIds[ms.market.iso2] = mid;
    d.markets.push({
      ...base(mid),
      name: ms.market.name,
      iso2: ms.market.iso2,
      currency: ms.market.currency,
      vat_name: ms.market.vat_name,
      status: ms.market.status as Market['status'],
      blocker: ms.market.blocker ?? null,
      alt_routes: ms.market.alt_routes ?? [],
      lat: ms.market.lat,
      lng: ms.market.lng,
    });
    for (const v of ms.values) tv('market', mid, v);
    for (const a of ms.areas ?? []) {
      const aid = seedId(`area:${ms.market.iso2}:${a.key}`);
      d.market_areas.push({ ...base(aid), market_id: mid, name: a.name });
      for (const v of a.values) tv('market_area', aid, v);
    }
    for (const s of ms.segments) {
      const sid = seedId(`segment:${ms.market.iso2}:${s.key}`);
      segmentIds[`${ms.market.iso2}:${s.key}`] = sid;
      d.segments.push({ ...base(sid), market_id: mid, outlet_type: s.outlet_type, area_id: null });
      for (const v of s.values) tv('segment', sid, v);
    }
    for (const c of ms.channels) {
      const cid = seedId(`channel:${ms.market.iso2}:${c.key}`);
      channelIds[c.key] = cid;
      d.channels.push({
        ...base(cid),
        market_id: mid,
        name: c.name,
        channel_type: c.channel_type as Dataset['channels'][number]['channel_type'],
        segment_ids: c.segments.map((k) => segmentIds[`${ms.market.iso2}:${k}`]).filter(Boolean),
        has_distributor_tier: c.distributor_tier,
        notes: c.notes ?? null,
      });
      for (const v of c.values ?? []) tv('channel', cid, v);
      const ctid = seedId(`channel_terms:${cid}`);
      d.channel_terms.push({ ...base(ctid), channel_id: cid, principal_id: null, delivery_mode: c.delivery_mode ?? null });
      for (const v of c.terms) tv('channel_terms', ctid, v);
    }
    for (const r of ms.trade_rules) {
      const rid = seedId(`trade_rule:${ms.market.iso2}:${r.hs_code}:${r.regime}:${r.origin_iso2 ?? 'any'}`);
      d.trade_rules.push({ ...base(rid), hs_code: r.hs_code, origin_iso2: r.origin_iso2, dest_iso2: ms.market.iso2, regime: r.regime, coo_form: r.coo_form, source: r.source });
      tv('trade_rule', rid, { field: 'duty_pct', label: `Duty ${r.regime} HS ${r.hs_code}`, value_num: r.duty_pct, unit: 'pct', tag: r.tag, source_label: r.source, source_url: r.source_url, note: r.note });
    }
    for (const g of ms.compliance_gates)
      d.compliance_gates.push({
        ...base(seedId(`gate:${ms.market.iso2}:${g.requirement}`)),
        market_id: mid, product_family_id: null, requirement: g.requirement, detail: g.detail ?? null, authority: g.authority ?? null,
        deadline: null, status: g.status ?? 'open', tag: g.tag as Tag, source: g.source ?? null, source_url: g.source_url ?? null,
      });
    for (const c of ms.competitors)
      d.competitor_brands.push({ ...base(seedId(`competitor:${ms.market.iso2}:${c.brand}`)), market_id: mid, category: 'dishwashing', ...c });
    for (const p of ms.partners) {
      const partnerId = seedId(`partner:${ms.market.iso2}:${p.name}`);
      d.partners.push({
        ...base(partnerId), market_id: mid, name: p.name, roles: p.roles as RouteType[], reach: p.reach ?? null, competing_lines: null, contact: null,
        deal_stage: p.deal_stage ?? 'identified', score: null, notes: p.notes ?? null,
      });
      for (const a of p.asks ?? [])
        d.partner_asks.push({
          ...base(seedId(`ask:${partnerId}:${a.metric}`)), partner_id: partnerId, metric: a.metric, value: a.value ?? null, value_text: a.value_text ?? null,
          unit: a.unit ?? null, asked_on: '2026-08-15', note: a.note ?? null,
        });
    }
    for (const e of ms.evidence)
      d.market_evidence.push({
        ...base(seedId(`evidence:${ms.market.iso2}:${e.statement}`)), market_id: mid, statement: e.statement, value: e.value ?? null,
        tag: e.tag as Tag, source: e.source ?? null, source_url: e.source_url ?? null, as_of: e.as_of ?? null,
      });
    for (const w of ms.watchouts ?? [])
      d.watchouts.push({ ...base(seedId(`watchout:${w.text}`)), text: w.text, stage_no: w.stage_no, category: w.category, learned_from_market_id: mid });
  }

  // Shared watch-out library seeded from the stage template.
  for (const it of stageTemplates.items)
    if (it.watch_out && !d.watchouts.some((w) => w.text === it.watch_out))
      d.watchouts.push({ ...base(seedId(`watchout:${it.watch_out}`)), text: it.watch_out, stage_no: it.stage_no, category: 'stage template', learned_from_market_id: it.watch_out.includes('Myanmar') ? marketIds.MM : null });

  for (const b of benchmarks)
    d.terms_benchmarks.push({
      ...base(seedId(`benchmark:${b.market ?? 'any'}:${b.role}:${b.metric}`)), market_id: b.market ? marketIds[b.market] : null, role: b.role, metric: b.metric,
      low: b.low ?? null, high: b.high ?? null, text_value: b.text_value ?? null, unit: b.unit ?? null, tag: b.tag as Tag, source: b.source ?? null, source_url: b.source_url ?? null,
    });

  // Catalogue
  const skuIds: Record<string, string> = {};
  for (const f of sgKeon.families) {
    const fid = seedId(`family:${f.key}`);
    d.product_families.push({ ...base(fid), brand_id: bid, name: f.name, category: f.category, base_formulation: f.base_formulation, certifications: f.certifications, hs_code: f.hs_code });
    for (const s of f.skus) {
      const sid = seedId(`sku:${s.sku_code}`);
      skuIds[s.sku_code] = sid;
      d.sku_configs.push({
        ...base(sid), family_id: fid, sku_code: s.sku_code, name: s.name, variant_attrs: s.variant_attrs, barcode: null, shelf_life_days: s.shelf_life_days,
        overrides: {},
      });
      for (const p of s.packs)
        d.pack_levels.push({
          ...base(seedId(`pack:${s.sku_code}:${p.level}`)), sku_config_id: sid, level: p.level as Dataset['pack_levels'][number]['level'], units_per_level: p.units_per_level,
          l_cm: 'l_cm' in p ? (p.l_cm as number) : null, w_cm: 'w_cm' in p ? (p.w_cm as number) : null, h_cm: 'h_cm' in p ? (p.h_cm as number) : null,
          gross_kg: 'gross_kg' in p ? (p.gross_kg as number) : null,
        });
      const priceId = seedId(`price:${s.sku_code}:supplier_exw`);
      d.sku_prices.push({ ...base(priceId), sku_config_id: sid, market_id: null, channel_id: null, price_type: 'supplier_exw', currency: 'SGD' });
      tv('sku_price', priceId, { field: 'price', label: `${s.sku_code} supplier EXW`, value_num: s.supplier_price, unit: 'SGD/unit', tag: 'placeholder', note: 'Illustrative — replace with the principal price list.' });
    }
  }

  // Plays (+ shelf prices per channel)
  for (const p of sgKeon.plays) {
    const playId = seedId(`play:${p.key}`);
    const mid = marketIds[p.market];
    const cid = channelIds[p.channel];
    const market = d.markets.find((m) => m.id === mid)!;
    const priceId = seedId(`price:${p.sku}:${p.channel}:shelf`);
    d.sku_prices.push({ ...base(priceId), sku_config_id: skuIds[p.sku], market_id: mid, channel_id: cid, price_type: 'shelf', currency: market.currency });
    tv('sku_price', priceId, { field: 'price', label: `${p.sku} shelf price at ${p.name.split(' · ')[0]}`, value_num: p.shelf_price, unit: `${market.currency}/unit`, tag: 'placeholder', note: 'Illustrative target shelf price — replace after store audit.' });
    d.plays.push({
      ...base(playId), name: p.name, sku_config_id: skuIds[p.sku], channel_id: cid, segment_id: segmentIds[`${p.market}:${p.segment}`] ?? null, market_id: mid,
      route_type: p.route_type as RouteType, status: p.status, assumption_overrides: {},
    });
    tv('play', playId, { field: 'q_realistic_month', label: 'Realistic volume', value_num: p.q_realistic_month, unit: 'units/month', tag: 'placeholder', note: 'Illustrative — replace with a forecast.' });
    tv('play', playId, { field: 'entry_cost', label: 'Entry cost', value_num: p.entry_cost, unit: market.currency, tag: 'placeholder', note: 'Illustrative — certification, listing and launch.' });
  }

  // Stage trackers
  for (const ms of MARKETS) {
    if (!ms.tracker) continue;
    const mid = marketIds[ms.market.iso2];
    const tid = seedId(`tracker:${ms.market.iso2}:${ms.tracker.principal}`);
    d.stage_trackers.push({ ...base(tid), market_id: mid, principal_id: pid, kind: 'entry', scope: null, parent_tracker_id: null, current_stage: 1, status: ms.market.status === 'paused' ? 'paused' : 'active' });
    let sort = 0;
    for (const it of stageTemplates.items) {
      const status = (ms.tracker.statuses[it.item] ?? 'not_started') as ItemStatus;
      d.stage_items.push({
        ...base(seedId(`stage_item:${tid}:${it.item}`)), tracker_id: tid, stage_no: it.stage_no, item: it.item, required: it.required, status,
        owner: null, due_date: null, evidence_path: null, watch_out: it.watch_out,
        note: ms.tracker.notes?.[it.item] ?? (ms.tracker.statuses[it.item] && ms.tracker.default_note ? ms.tracker.default_note : null),
        sort: sort++,
      });
    }
    for (const x of ms.tracker.extra_items)
      d.stage_items.push({
        ...base(seedId(`stage_item:${tid}:${x.item}`)), tracker_id: tid, stage_no: x.stage_no, item: x.item, required: x.required, status: x.status as ItemStatus,
        owner: null, due_date: null, evidence_path: null, watch_out: x.watch_out ?? null, note: x.note ?? ms.tracker.default_note ?? null, sort: sort++,
      });
  }

  // Supply-chain map drafted from the production site + channels with plays.
  const playChannels = d.channels.filter((c) => d.plays.some((p) => p.channel_id === c.id));
  const draft = draftSupplyChain(pid, d.production_sites, playChannels, d.markets);
  const nodeId = (k: string) => seedId(`node:${pid}:${k}`);
  for (const n of draft.nodes) {
    const { key, ...rest } = n;
    d.sc_nodes.push({ ...base(nodeId(key)), ...rest });
  }
  for (const l of draft.lanes) {
    const { from, to, ...rest } = l;
    d.sc_lanes.push({ ...base(seedId(`lane:${pid}:${from}:${to}`)), from_node: nodeId(from), to_node: nodeId(to), ...rest });
  }

  d.scenarios.push({
    ...base(seedId('scenario:capital-cap')), name: 'Next 12 months — SGD 30k capital cap', play_ids: d.plays.map((p) => p.id),
    limits: { capital: 30000, wc_limit: null, people: 1.5, pallets: null }, overrides: {},
  });

  d.setup_snapshots.push({ ...base(seedId(`snapshot:${pid}:seed`)), principal_id: pid, step: null, snapshot: { seeded: true, principal: sgKeon.principal.name }, taken_at: SEED_TIME });
  return d;
}

export function seedCounts(d: Dataset): Partial<Record<TableName, number>> {
  return Object.fromEntries(Object.entries(d).filter(([, rows]) => rows.length).map(([t, rows]) => [t, rows.length]));
}
