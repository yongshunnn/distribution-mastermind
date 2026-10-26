// Extra, clearly fictional activity layered on the starter seed for trial mode only,
// so every screen has something to explore. Never written to the live database.
import type { Tag } from '@/lib/calc/traced';
import type { Dataset } from '@/lib/db/types';
import { seedId } from './ids';

const T = '2026-10-26T00:00:00.000Z';
const SRC = 'Trial sample (fictional)';
const base = (id: string) => ({ id: seedId(`trial:${id}`), created_at: T, updated_at: T, created_by: null });

export function addTrialExtras(d: Dataset): Dataset {
  const market = (iso: string) => d.markets.find((m) => m.iso2 === iso)!;
  const MY = market('MY');
  const SG = market('SG');
  const principal = d.principals[0];
  const brand = d.brands[0];
  const sku = (code: string) => d.sku_configs.find((s) => s.sku_code === code)!;
  const channel = (name: string) => d.channels.find((c) => c.name === name)!;
  const area = (name: string) => d.market_areas.find((a) => a.name === name)?.id ?? null;
  const tv = (key: string, entity_type: string, entity_id: string, field: string, label: string, value_num: number | null, unit: string, note?: string) =>
    d.tracked_values.push({
      ...base(`tv:${key}`), entity_type, entity_id, field, label, value_num, value_text: null, unit, tag: 'placeholder' as Tag,
      source_label: SRC, source_url: null, as_of: '2026-10-20', note: note ?? 'Sample figure for exploring the platform — not real data.', is_current: true, replaced_by: null,
    });

  // Malaysia store audit — fictional brands across outlet tiers.
  const obs: [string, string, number, string, number, number, string, 'local' | 'imported', string, string | null][] = [
    ['Sunzest', 'premium', 900, 'ml', 8.9, 4, 'Lemon', 'local', 'Selangor', 'Antibacterial'],
    ['Sunzest', 'mainstream', 400, 'ml', 4.2, 6, 'Lemon', 'local', 'Selangor', null],
    ['Kilat Bersih', 'mainstream', 900, 'ml', 6.5, 8, 'Lime', 'local', 'Kuala Lumpur', null],
    ['Kilat Bersih', 'wholesale', 3.5, 'l', 21.9, 3, 'Lime', 'local', 'Selangor', null],
    ['Kilat Bersih', 'traditional', 400, 'ml', 3.6, 2, 'Lime', 'local', 'Johor', null],
    ['Daun Hijau', 'mainstream', 750, 'ml', 5.9, 5, 'Pandan', 'local', 'Penang', 'Plant-based'],
    ['Daun Hijau', 'convenience', 400, 'ml', 4.5, 2, 'Pandan', 'local', 'Kuala Lumpur', 'Plant-based'],
    ['Crystal Shine', 'premium', 500, 'ml', 9.9, 3, 'Grapefruit', 'imported', 'Kuala Lumpur', 'Concentrated'],
    ['Crystal Shine', 'premium', 1, 'l', 16.9, 2, 'Grapefruit', 'imported', 'Selangor', 'Concentrated'],
    ['ValuMart Basics', 'wholesale', 5, 'l', 24.9, 4, 'Lemon', 'local', 'Selangor', null],
    ['ValuMart Basics', 'mainstream', 1, 'l', 5.2, 6, 'Lemon', 'local', 'Johor', null],
    ['Ombak', 'traditional', 800, 'ml', 4.9, 3, 'Lemon', 'local', 'Johor', null],
    ['Ombak', 'convenience', 400, 'ml', 3.9, 2, 'Lemon', 'local', 'Penang', null],
    ['Teh Wangi', 'mainstream', 900, 'ml', 6.9, 4, 'Green tea', 'imported', 'Kuala Lumpur', null],
  ];
  obs.forEach(([b, tier, size, unit, price, facings, scent, origin, ar, claim], i) =>
    d.shelf_observations.push({
      ...base(`obs:${i}`), market_id: MY.id, category: 'dishwashing', outlet_name: `Sample outlet ${i + 1}`, outlet_tier: tier, area_id: area(ar),
      observed_on: '2026-10-18', brand: b, owner: `${b} (fictional)`, pack_size: size, pack_unit: unit, price, currency: 'MYR', facings,
      attributes: { scent, ...(claim ? { claim } : {}), label_langs: 'BM/EN' }, origin, photo_path: null,
    }),
  );
  d.competitor_brands.push(
    { ...base('comp:kilat'), market_id: MY.id, category: 'dishwashing', brand: 'Kilat Bersih (sample)', owner: 'Fictional local maker', pack_sizes: ['400ml', '900ml', '3.5L'], positioning: 'Everyday value, lime scent', structural_strength: 'Deep wholesale and traditional-trade coverage', weakness: 'No premium or concentrated line', how_we_win: 'Lead with the enzyme formula in modern trade; match the 3.5L bulk pack for wholesale' },
    { ...base('comp:crystal'), market_id: MY.id, category: 'dishwashing', brand: 'Crystal Shine (sample)', owner: 'Fictional importer', pack_sizes: ['500ml', '1L'], positioning: 'Premium imported concentrate', structural_strength: 'Strong eye-level placement in premium chains', weakness: 'Priced at 2–3× mainstream', how_we_win: 'Offer premium performance at a mainstream-plus price' },
  );

  // Malaysia partners — one ask above benchmark, one within.
  const pA = seedId('trial:partner:a');
  const pB = seedId('trial:partner:b');
  d.partners.push(
    { ...base('partner:a'), id: pA, market_id: MY.id, name: 'Sample Distributor A Sdn Bhd', roles: ['distributor'], reach: 'Klang Valley + Johor; 1,200 outlets (fictional)', competing_lines: 'Carries a local dishwashing brand', contact: null, deal_stage: 'terms_received', score: 68, notes: SRC },
    { ...base('partner:b'), id: pB, market_id: MY.id, name: 'Sample Distributor B Sdn Bhd', roles: ['distributor', 'importer_of_record'], reach: 'Nationwide, strong in Penang (fictional)', competing_lines: null, contact: null, deal_stage: 'in_contact', score: 74, notes: SRC },
  );
  d.partner_asks.push(
    { ...base('ask:a:gm'), partner_id: pA, metric: 'gross_margin', value: 10, value_text: null, unit: 'pct', asked_on: '2026-10-15', note: 'Sample ask' },
    { ...base('ask:a:credit'), partner_id: pA, metric: 'credit_days', value: 45, value_text: null, unit: 'days', asked_on: '2026-10-15', note: 'Sample ask — above the 7–21 day benchmark' },
    { ...base('ask:b:gm'), partner_id: pB, metric: 'gross_margin', value: 7, value_text: null, unit: 'pct', asked_on: '2026-10-19', note: 'Sample ask' },
  );

  // Six months of principal-reported sales for the Singapore plays.
  const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  months.forEach((m, i) => {
    d.sales_records.push(
      { ...base(`sales:f:${m}`), sku_config_id: sku('KEON-DW-1L').id, channel_id: channel('Fortune').id, market_id: SG.id, month: `${m}-01`, units: 1100 + i * 80, value: (1100 + i * 80) * 2.25, currency: 'SGD', source: 'principal_reported' },
      { ...base(`sales:fm:${m}`), sku_config_id: sku('KEON-DW-5L').id, channel_id: channel('FoodMax').id, market_id: SG.id, month: `${m}-01`, units: 520 + i * 45, value: (520 + i * 45) * 9.4, currency: 'SGD', source: 'principal_reported' },
    );
  });

  // A mixed fee model so the principal P&L has something to show.
  const fRet = seedId('trial:fee:retainer');
  const fCom = seedId('trial:fee:commission');
  const fShare = seedId('trial:fee:share');
  d.principal_fee_terms.push(
    { ...base('fee:retainer'), id: fRet, principal_id: principal.id, model: 'retainer', basis: 'monthly', currency: 'SGD', start_date: '2026-11-01', end_date: null },
    { ...base('fee:commission'), id: fCom, principal_id: principal.id, model: 'commission', basis: 'net_sales', currency: 'SGD', start_date: '2026-11-01', end_date: null },
    { ...base('fee:share'), id: fShare, principal_id: principal.id, model: 'profit_share', basis: 'market_npat_after_payback', currency: 'SGD', start_date: '2026-11-01', end_date: null },
  );
  tv('fee:retainer', 'principal_fee_terms', fRet, 'amount_or_pct', 'Monthly retainer', 1500, 'SGD/month');
  tv('fee:commission', 'principal_fee_terms', fCom, 'amount_or_pct', 'Commission on net sales', 3, 'pct');
  tv('fee:share', 'principal_fee_terms', fShare, 'amount_or_pct', 'Share of market NPAT after payback', 20, 'pct');
  tv('invest:my', 'principal', principal.id, 'investment_MY', 'Principal investment to pay back (MY)', 25000, 'SGD');

  // Sample attractiveness scores.
  const score = (m: string, k: string, v: number, why: string) => tv(`score:${m}:${k}`, 'market', market(m).id, `score_${k}`, `Score — ${k.replace(/_/g, ' ')}`, v, 'score', `Sample score: ${why}`);
  score('MY', 'access', 65, 'no WRT licence needed with a local distributor');
  score('MY', 'competition', 45, 'crowded mainstream, thin premium');
  score('MY', 'right_to_win', 60, 'enzyme formula, SG proximity');
  score('MY', 'growth', 55, 'modern trade growing; population +0.5%');
  score('SG', 'size', 30, 'small population, dense F&B');
  score('SG', 'access', 85, 'already selling; GST recoverable');
  score('SG', 'competition', 40, 'multinationals dominate shelves');
  score('SG', 'right_to_win', 70, 'local principal, FoodMax access');
  score('SG', 'growth', 40, 'mature market');

  // Positioning and a market-watch note.
  d.positioning.push({ ...base('pos:my'), brand_id: brand.id, market_id: MY.id, master_positioning: 'Cuts grease faster with an enzyme formula — made in Singapore (sample)', sub_line: 'Halal-ready B2B packs for food service (sample)', claims: ['Enzyme formula', 'Gentle on hands'] });
  const nsk = d.plays.find((p) => p.name?.startsWith('NSK'));
  d.market_watch_notes.push({
    ...base('watch:sst'), market_id: MY.id, headline: 'Sample note: sales tax review flagged for household cleaners', source: SRC, source_url: null, published_on: '2026-10-20',
    impact: 'If the rate moves from 10% to 5%, landed cost on Malaysian plays falls — re-check the NSK play.', flags: { play_ids: nsk ? [nsk.id] : [], gate_ids: [], status_change: null },
  });

  // A little stage-tracker progress on Malaysia.
  const myTracker = d.stage_trackers.find((t) => t.market_id === MY.id);
  for (const it of d.stage_items.filter((i) => i.tracker_id === myTracker?.id)) {
    if (it.item === 'Market scorecard filled') Object.assign(it, { status: 'done', owner: 'Yong Shun', note: 'Sample: scored in trial mode.' });
    if (it.item === 'Store audit across outlet tiers') Object.assign(it, { status: 'in_progress', owner: 'Field team', due_date: '2026-11-15', note: 'Sample: 14 SKUs logged so far.' });
    if (it.item === 'Open question: two distributor quotes') Object.assign(it, { status: 'in_progress', owner: 'Yong Shun', due_date: '2026-10-25', note: 'Sample: one quote received — overdue.' });
  }
  return d;
}
