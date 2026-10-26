import 'server-only';
import { cache } from 'react';
import { convert, convertNumber, hasFx } from '@/lib/calc/fx';
import { dutyRate, type TradeRule } from '@/lib/calc/trade';
import {
  chainLayers, PLAY_INPUT_KEYS, playEconomics, withSensitivities,
  type ChainLayer, type PlayContext, type PlayEconomics, type PlayInputKey, type PlayInputs,
} from '@/lib/calc/play';
import { calc, labelOf, leaf, markStale, type Traced } from '@/lib/calc/traced';
import { CURRENCY_RE, fxRates, rows, settings, tracedFromValue, valueIndex, WORKSPACE_ID, type ValueIndex } from './data';
import type { Channel, Market, Play, ProductFamily, Segment, SkuConfig, TrackedValue } from './types';

export interface Lookup {
  where: string; // human description of where the value lives
  level: 'play' | 'channel_terms' | 'channel' | 'market' | 'workspace' | 'derived' | 'missing';
}

export interface BuiltPlay {
  play: Play;
  sku: SkuConfig;
  family: ProductFamily | undefined;
  channel: Channel;
  market: Market;
  segment: Segment | undefined;
  principalId: string | null;
  ctx: PlayContext;
  inputs: PlayInputs;
  lookups: Record<PlayInputKey, Lookup>;
  econ: PlayEconomics;
  layers: ChainLayer[];
  unitsPerCarton: number;
  sizeLitres: number;
  /** SGD equivalents for portfolio totals. */
  sgd: { perMonth: number; entry: number; peakCash: number };
  warnings: string[];
}

function convertTraced(t: Traced, market: Market, fx: Awaited<ReturnType<typeof fxRates>>): Traced {
  const m = t.unit.match(CURRENCY_RE);
  if (!m || m[1] === market.currency) return t;
  if (!hasFx(m[1], market.currency, fx)) return { ...t, note: [t.note, `No FX rate ${m[1]} → ${market.currency}; shown unconverted.`].filter(Boolean).join(' ') };
  return convert(t, m[1], market.currency, fx);
}

export const buildAllPlays = cache(async (): Promise<BuiltPlay[]> => {
  const plays = await rows('plays');
  const out: BuiltPlay[] = [];
  for (const p of plays) {
    const b = await buildPlay(p.id);
    if (b) out.push(b);
  }
  return out;
});

export const buildPlay = cache(async (playId: string): Promise<BuiltPlay | null> => {
  const [plays, skus, families, brands, channels, markets, segments, terms, prices, packs, rules, sites, fx, idx, cfg] = await Promise.all([
    rows('plays'), rows('sku_configs'), rows('product_families'), rows('brands'), rows('channels'), rows('markets'), rows('segments'),
    rows('channel_terms'), rows('sku_prices'), rows('pack_levels'), rows('trade_rules'), rows('production_sites'), fxRates(), valueIndex(), settings(),
  ]);
  const play = plays.find((p) => p.id === playId);
  if (!play) return null;
  const sku = skus.find((s) => s.id === play.sku_config_id);
  const channel = channels.find((c) => c.id === play.channel_id);
  const market = markets.find((m) => m.id === play.market_id);
  if (!sku || !channel || !market) return null;
  const family = families.find((f) => f.id === sku.family_id);
  const brand = brands.find((b) => b.id === family?.brand_id);
  const principalId = brand?.principal_id ?? null;
  const segment = segments.find((s) => s.id === play.segment_id);
  const warnings: string[] = [];
  const distributorTier = channel.has_distributor_tier || play.route_type === 'distributor';
  const ctx: PlayContext = { currency: market.currency, distributorTier };
  const termRows = terms.filter((t) => t.channel_id === channel.id);
  const principalTerms = termRows.find((t) => t.principal_id && t.principal_id === principalId);
  const genericTerms = termRows.find((t) => !t.principal_id);
  const u = `${market.currency}/unit`;

  // Pack data
  const skuPacks = packs.filter((p) => p.sku_config_id === sku.id);
  const carton = skuPacks.find((p) => p.level === 'carton');
  const pallet = skuPacks.find((p) => p.level === 'pallet');
  const unitsPerCarton = Number(carton?.units_per_level ?? 1);
  const sizeMl = Number((sku.variant_attrs as Record<string, unknown>).size_ml ?? 0);

  const inputs = {} as PlayInputs;
  const lookups = {} as Record<PlayInputKey, Lookup>;

  const fromValue = (key: PlayInputKey, v: TrackedValue, where: string, level: Lookup['level']) => {
    let t = tracedFromValue(v, idx, key);
    t = { ...t, label: labelOf(key, v.label ?? undefined), meaning: t.meaning };
    if (level !== 'play') t.note = [t.note, `Set at ${where} — applies to every play there unless overridden.`].filter(Boolean).join(' ');
    t = convertTraced(t, market, fx);
    inputs[key] = t;
    lookups[key] = { where, level };
  };

  const lookupChain = (key: PlayInputKey, fields: string[]): boolean => {
    for (const f of fields) {
      const pv = idx.get('play', play.id, f);
      if (pv) return fromValue(key, pv, 'this play', 'play'), true;
      if (principalTerms) {
        const v = idx.get('channel_terms', principalTerms.id, f);
        if (v) return fromValue(key, v, `${channel.name} terms (this principal)`, 'channel_terms'), true;
      }
      if (genericTerms) {
        const v = idx.get('channel_terms', genericTerms.id, f);
        if (v) return fromValue(key, v, `${channel.name} terms`, 'channel_terms'), true;
      }
      const cv = idx.get('channel', channel.id, f);
      if (cv) return fromValue(key, cv, channel.name, 'channel'), true;
      const mv = idx.get('market', market.id, f);
      if (mv) return fromValue(key, mv, `${market.name} market defaults`, 'market'), true;
      const wv = idx.get('workspace', WORKSPACE_ID, f);
      if (wv) return fromValue(key, wv, 'workspace settings', 'workspace'), true;
    }
    return false;
  };

  const derived = (key: PlayInputKey, t: Traced, where = 'derived') => {
    inputs[key] = t;
    lookups[key] = { where, level: 'derived' };
  };

  for (const key of PLAY_INPUT_KEYS) {
    // Play-level overrides always win.
    if (idx.get('play', play.id, key)) {
      lookupChain(key, [key]);
      continue;
    }
    switch (key) {
      case 'supplier_price': {
        const pr = prices.find((x) => x.sku_config_id === sku.id && (x.price_type === 'supplier_exw' || x.price_type === 'fob'));
        const v = pr && idx.get('sku_price', pr.id, 'price');
        if (v) fromValue(key, v, `${sku.sku_code} price list`, 'derived');
        break;
      }
      case 'shelf_price': {
        const shelf = prices.filter((x) => x.sku_config_id === sku.id && x.price_type === 'shelf' && x.market_id === market.id);
        const pr = shelf.find((x) => x.channel_id === channel.id) ?? shelf.find((x) => !x.channel_id);
        const v = pr && idx.get('sku_price', pr.id, 'price');
        if (v) fromValue(key, v, `${sku.sku_code} shelf price`, 'derived');
        break;
      }
      case 'duty_rate': {
        const site = sites.find((s) => s.principal_id === principalId);
        const origin = (play.assumption_overrides.origin_iso2 as string) ?? site?.country ?? market.iso2;
        const coo = (play.assumption_overrides.coo_forms as string[]) ?? [];
        const ruleRows: TradeRule[] = rules.map((r) => {
          const dv = idx.get('trade_rule', r.id, 'duty_pct');
          return { id: r.id, hs_code: r.hs_code, origin_iso2: r.origin_iso2, dest_iso2: r.dest_iso2, regime: r.regime, coo_form: r.coo_form, duty_pct: Number(dv?.value_num ?? 0), tag: dv?.tag ?? 'placeholder', source: dv?.source_label ?? r.source, source_url: dv?.source_url, as_of: dv?.as_of };
        });
        derived(key, dutyRate(ruleRows, family?.hs_code ?? '', origin, market.iso2, coo), 'trade rules');
        break;
      }
      case 'units_per_pallet':
        if (pallet) derived(key, leaf(key, Number(pallet.units_per_level), 'units', { tag: 'measured', source: { label: `${sku.sku_code} pack levels` }, note: 'From the pack hierarchy. Edit in Catalogue.' }), 'pack levels');
        break;
      case 'volume_per_unit_m3':
        if (carton?.l_cm && carton.w_cm && carton.h_cm) {
          const vol = (Number(carton.l_cm) * Number(carton.w_cm) * Number(carton.h_cm)) / 1e6 / unitsPerCarton;
          derived(key, leaf(key, vol, 'm³', { tag: 'measured', source: { label: `${sku.sku_code} carton dimensions` }, note: `Carton ${carton.l_cm}×${carton.w_cm}×${carton.h_cm} cm ÷ ${unitsPerCarton} units. Edit in Catalogue.` }), 'pack levels');
        }
        break;
      case 'receivable_days':
        lookupChain(key, distributorTier ? ['distributor_credit_days', 'receivable_days'] : ['receivable_days']);
        break;
      case 'distributor_margin':
        if (!distributorTier) derived(key, leaf(key, 0, '%', { tag: 'computed', note: 'No distributor between us and this channel.' }));
        else lookupChain(key, ['distributor_margin']);
        break;
      default:
        lookupChain(key, [key]);
    }
    if (!inputs[key]) {
      const unit = /(rate|margin|rebate)$/.test(key) ? '%' : key === 'import_tax_recoverable' ? 'flag' : key.endsWith('_days') ? 'days' : u;
      inputs[key] = leaf(key, 0, unit, { tag: 'placeholder', note: 'No value yet — treated as zero. Add one to replace this placeholder.' });
      lookups[key] = { where: 'missing', level: 'missing' };
    }
  }
  // listing period depends on Q, which comes later in the key order.
  if (lookups.listing_period_units.level === 'missing' && inputs.q_realistic_month.value > 0) {
    derived('listing_period_units', calc('listing_period_units', inputs.q_realistic_month.value * 12, 'units', 'Q_realistic × 12 months', [inputs.q_realistic_month], { label: 'Units over listing period (12 months)' }));
  }

  const vdt = idx.get('workspace', WORKSPACE_ID, 'value_density_threshold');
  if (vdt?.value_num != null) {
    const thr = Number(vdt.value_num);
    ctx.valueDensityThreshold = market.currency === 'SGD' || !hasFx('SGD', market.currency, fx) ? thr : convertNumber(thr, 'SGD', market.currency, fx);
  }

  let econ = withSensitivities(playEconomics(inputs, ctx), inputs, ctx);
  const today = new Date();
  econ = Object.fromEntries(Object.entries(econ).map(([k, v]) => [k, typeof v === 'object' ? markStale(v as Traced, cfg.staleDays, today) : v])) as unknown as PlayEconomics;
  const toSgd = (v: number) => (market.currency === 'SGD' ? v : hasFx(market.currency, 'SGD', fx) ? convertNumber(v, market.currency, 'SGD', fx) : 0);
  const withAlt = (t: Traced): Traced => (market.currency === 'SGD' || !t.unit.startsWith(market.currency) ? t : { ...t, alt: { value: toSgd(t.value), unit: t.unit.replace(market.currency, 'SGD') } });
  econ = Object.fromEntries(Object.entries(econ).map(([k, v]) => [k, typeof v === 'object' ? withAlt(v as Traced) : v])) as unknown as PlayEconomics;

  if (econ.C.value < 0) warnings.push('Negative contribution — this play loses money on every unit.');
  if (econ.valueDensityLow) warnings.push('Low value density — freight and space will eat margin. Consider local co-packing.');
  const placeholders = Object.values(inputs).filter((t) => t.tag === 'placeholder').length;
  if (placeholders) warnings.push(`${placeholders} of ${PLAY_INPUT_KEYS.length} inputs are placeholders.`);

  return {
    play, sku, family, channel, market, segment, principalId, ctx, inputs, lookups, econ,
    layers: chainLayers(econ, inputs, ctx),
    unitsPerCarton,
    sizeLitres: sizeMl / 1000,
    sgd: { perMonth: toSgd(econ.perMonth.value), entry: toSgd(inputs.entry_cost.value), peakCash: toSgd(econ.peakCash.value) },
    warnings,
  };
});

export function playTitle(b: Pick<BuiltPlay, 'play' | 'sku' | 'channel'>): string {
  return b.play.name ?? `${b.channel.name} · ${b.sku.sku_code}`;
}

export type { ValueIndex };
