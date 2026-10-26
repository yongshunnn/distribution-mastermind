import 'server-only';
import { rows, valueIndex } from './data';
import { getStore } from './store';
import type { Principal } from './types';

/** Everything that makes up a principal's setup — stored as a dated snapshot after every wizard save. */
export async function principalSetup(principalId: string) {
  const [principals, brands, families, skus, packs, sites, fees, terms, channels, sales, idx] = await Promise.all([
    rows('principals'), rows('brands'), rows('product_families'), rows('sku_configs'), rows('pack_levels'), rows('production_sites'),
    rows('principal_fee_terms'), rows('channel_terms'), rows('channels'), rows('sales_records'), valueIndex(),
  ]);
  const principal = principals.find((p) => p.id === principalId);
  if (!principal) return null;
  const b = brands.filter((x) => x.principal_id === principalId);
  const f = families.filter((x) => b.some((bb) => bb.id === x.brand_id));
  const s = skus.filter((x) => f.some((ff) => ff.id === x.family_id));
  const t = terms.filter((x) => x.principal_id === principalId);
  return {
    principal,
    brands: b,
    families: f,
    skus: s,
    packs: packs.filter((x) => s.some((ss) => ss.id === x.sku_config_id)),
    sites: sites.filter((x) => x.principal_id === principalId),
    fees: fees.filter((x) => x.principal_id === principalId).map((x) => ({ ...x, amount: idx.get('principal_fee_terms', x.id, 'amount_or_pct') ?? null })),
    terms: t.map((x) => ({ ...x, channel: channels.find((c) => c.id === x.channel_id)?.name, values: idx.forEntity('channel_terms', x.id) })),
    sales: sales.filter((x) => s.some((ss) => ss.id === x.sku_config_id)),
  };
}

export type PrincipalSetup = NonNullable<Awaited<ReturnType<typeof principalSetup>>>;

/** Fields the wizard flags when empty (missing is allowed, but visible). */
export function missingFields(p: PrincipalSetup): Record<number, string[]> {
  const pr: Principal = p.principal;
  return {
    1: [!pr.country && 'country', !pr.contact && 'contact', !pr.contract_type && 'contract type', !pr.territories.length && 'territories', !p.brands.length && 'brand', !p.fees.length && 'fee model'].filter(Boolean) as string[],
    2: [!p.sites.length && 'production site', ...p.sites.flatMap((s) => [s.lat == null && `${s.name}: lat/lng`, !s.moq && `${s.name}: MOQ`, !s.lead_time_days && `${s.name}: lead time`])].filter(Boolean) as string[],
    3: [!p.families.length && 'product family', !p.skus.length && 'SKU configurations', ...p.skus.filter((s) => !p.packs.some((k) => k.sku_config_id === s.id && k.level === 'carton')).map((s) => `${s.sku_code}: carton pack`), ...p.families.filter((f) => !f.hs_code).map((f) => `${f.name}: HS code`)].filter(Boolean) as string[],
    4: [!p.terms.length && 'channel terms for this principal'].filter(Boolean) as string[],
    5: [!p.sales.length && 'monthly sales records'].filter(Boolean) as string[],
    6: [],
  };
}

export async function snapshot(principalId: string, step: number | null) {
  const setup = await principalSetupFresh(principalId);
  if (!setup) return;
  const store = await getStore();
  await store.insert('setup_snapshots', [{ principal_id: principalId, step, snapshot: JSON.parse(JSON.stringify(setup)), taken_at: new Date().toISOString() }]);
}

/** Uncached read for use inside server actions after writes. */
async function principalSetupFresh(principalId: string) {
  const store = await getStore();
  const [principal, brands, sites, fees] = await Promise.all([
    store.get('principals', principalId), store.list('brands', { principal_id: principalId }), store.list('production_sites', { principal_id: principalId }), store.list('principal_fee_terms', { principal_id: principalId }),
  ]);
  if (!principal) return null;
  const families = (await store.list('product_families')).filter((f) => brands.some((b) => b.id === f.brand_id));
  const skus = (await store.list('sku_configs')).filter((s) => families.some((f) => f.id === s.family_id));
  const terms = await store.list('channel_terms', { principal_id: principalId });
  return { principal, brands, sites, fees, families, skus, terms };
}
