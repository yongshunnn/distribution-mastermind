// Row types mirroring supabase/migrations. Hand-written (kept small) instead of generated.
import type { Tag } from '@/lib/calc/traced';

export interface Base {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export type MarketStatus = 'active' | 'exploring' | 'paused';
export type ChannelType = 'retail_chain' | 'b2b_platform' | 'distributor' | 'wholesale' | 'direct_van' | 'ecommerce';
export type RouteType = 'importer_of_record' | 'distributor' | 'full_service_distributor' | 'co_packer' | 'b2b_platform' | 'retail_chain' | 'own_entry';
export type ItemStatus = 'not_started' | 'in_progress' | 'done' | 'not_needed' | 'blocked';
export type PackLevel = 'each' | 'inner' | 'carton' | 'pallet' | 'container';
export type PriceType = 'supplier_exw' | 'fob' | 'list' | 'shelf';
export type NodeType = 'factory' | 'origin_port' | 'dest_port' | 'importer_wh' | 'bonded_wh' | 'distributor_wh' | '3pl' | 'retail_dc' | 'outlet' | 'consumer';

export interface AllowedUser { email: string; display_name: string | null; role: string; created_at: string }
export interface Setting { key: string; value: unknown; updated_at: string }

export interface TrackedValue extends Base {
  entity_type: string;
  entity_id: string;
  field: string;
  label: string | null;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  tag: Tag;
  source_label: string | null;
  source_url: string | null;
  as_of: string | null;
  note: string | null;
  is_current: boolean;
  replaced_by: string | null;
}

export interface Principal extends Base {
  name: string; country: string | null; contact: string | null;
  contract_type: 'exclusive_distribution' | 'agency' | 'trade_services' | null;
  territories: string[]; exclusivity: string | null; status: string; notes: string | null;
}
export interface PrincipalFeeTerm extends Base {
  principal_id: string; model: 'retainer' | 'commission' | 'profit_share'; basis: string | null; currency: string;
  start_date: string | null; end_date: string | null;
}
export interface Brand extends Base { principal_id: string; name: string; origin_claim: string | null; story: string | null }
export interface ProductFamily extends Base {
  brand_id: string; name: string; category: string | null; base_formulation: string | null; certifications: string[]; hs_code: string | null;
}
export interface SkuConfig extends Base {
  family_id: string; sku_code: string; name: string | null; variant_attrs: Record<string, unknown>; barcode: string | null;
  shelf_life_days: number | null; overrides: Record<string, unknown>;
}
export interface PackLevelRow extends Base {
  sku_config_id: string; level: PackLevel; units_per_level: number;
  l_cm: number | null; w_cm: number | null; h_cm: number | null; gross_kg: number | null;
}
export interface ProductionSite extends Base {
  principal_id: string; name: string; country: string | null; lat: number | null; lng: number | null; capacity: string | null;
  moq: string | null; lead_time_days: number | null; incoterm: string | null; currency: string | null;
}
export interface Market extends Base {
  name: string; iso2: string; currency: string; vat_name: string | null; status: MarketStatus; blocker: string | null;
  alt_routes: string[]; lat: number | null; lng: number | null;
}
export interface Positioning extends Base { brand_id: string; market_id: string; master_positioning: string | null; sub_line: string | null; claims: string[] }
export interface MarketListing extends Base {
  sku_config_id: string; market_id: string; label_language: string | null; registration_status: string | null; halal_status: string | null;
  local_item_code: string | null; label_file_path: string | null;
}
export interface MarketArea extends Base { market_id: string; name: string }
export interface Segment extends Base { market_id: string; outlet_type: string; area_id: string | null }
export interface Channel extends Base {
  market_id: string; name: string; channel_type: ChannelType; segment_ids: string[]; has_distributor_tier: boolean; notes: string | null;
}
export interface SkuPrice extends Base {
  sku_config_id: string; market_id: string | null; channel_id: string | null; price_type: PriceType; currency: string;
}
export interface ChannelTerms extends Base { channel_id: string; principal_id: string | null; delivery_mode: string | null }
export interface Account extends Base { channel_id: string; name: string }
export interface SalesRecord extends Base {
  sku_config_id: string; channel_id: string | null; market_id: string; month: string; units: number | null; value: number | null;
  currency: string | null; source: 'actual' | 'principal_reported';
}
export interface Order extends Base { market_id: string | null; channel_id: string | null; account_id: string | null; ordered_on: string | null; status: string | null; lines: unknown[] }
export interface CostLine extends Base { market_id: string | null; order_id: string | null; kind: string; amount: number | null; currency: string | null; incurred_on: string | null; note: string | null }
export interface ScNode extends Base {
  principal_id: string | null; name: string; node_type: NodeType; market_id: string | null; lat: number | null; lng: number | null; stock_days: number | null;
}
export interface ScLane extends Base {
  from_node: string; to_node: string; mode: 'truck' | 'sea_fcl' | 'sea_lcl' | 'air' | 'courier'; lead_time_days: number | null;
  cost_per_unit: number | null; cost_per_m3: number | null; currency: string | null; payer: string | null; tag: Tag; source_label: string | null;
}
export interface TradeRuleRow extends Base {
  hs_code: string; origin_iso2: string | null; dest_iso2: string; regime: string; coo_form: string | null; source: string | null;
}
export interface ComplianceGate extends Base {
  market_id: string; product_family_id: string | null; requirement: string; detail: string | null; authority: string | null;
  deadline: string | null; status: string; tag: Tag; source: string | null; source_url: string | null;
}
export interface ShelfObservation extends Base {
  market_id: string; category: string; outlet_name: string | null; outlet_tier: string | null; area_id: string | null; observed_on: string;
  brand: string; owner: string | null; pack_size: number; pack_unit: string; price: number; currency: string; facings: number | null;
  attributes: Record<string, unknown>; origin: 'local' | 'imported' | null; photo_path: string | null;
}
export interface CompetitorBrand extends Base {
  market_id: string; category: string; brand: string; owner: string | null; pack_sizes: string[]; positioning: string | null;
  structural_strength: string | null; weakness: string | null; how_we_win: string;
}
export interface PartnerRole extends Base {
  role: RouteType; label: string; what_partner_brings: string | null; what_we_bring: string | null; commercial_framework: string | null; what_we_ask_first: string | null;
}
export interface Partner extends Base {
  market_id: string | null; name: string; roles: RouteType[]; reach: string | null; competing_lines: string | null; contact: string | null;
  deal_stage: string; score: number | null; notes: string | null;
}
export interface TermsBenchmark extends Base {
  market_id: string | null; role: string; metric: string; low: number | null; high: number | null; text_value: string | null; unit: string | null;
  tag: Tag; source: string | null; source_url: string | null;
}
export interface PartnerAsk extends Base {
  partner_id: string; metric: string; value: number | null; value_text: string | null; unit: string | null; asked_on: string | null; note: string | null;
}
export interface MarketEvidence extends Base {
  market_id: string; statement: string; value: string | null; tag: Tag; source: string | null; source_url: string | null; as_of: string | null;
}
export interface Play extends Base {
  name: string | null; sku_config_id: string; channel_id: string; segment_id: string | null; market_id: string; route_type: RouteType;
  status: string; assumption_overrides: Record<string, unknown>;
}
export interface Scenario extends Base {
  name: string; play_ids: string[]; limits: { capital?: number | null; wc_limit?: number | null; people?: number | null; pallets?: number | null };
  overrides: Record<string, unknown>;
}
export interface StageTemplate extends Base { stage_no: number; name: string }
export interface StageItemTemplate extends Base { stage_no: number; item: string; required: boolean; watch_out: string | null; sort: number }
export interface StageTracker extends Base {
  market_id: string; principal_id: string; kind: string; scope: string | null; parent_tracker_id: string | null; current_stage: number; status: string;
}
export interface StageItem extends Base {
  tracker_id: string; stage_no: number; item: string; required: boolean; status: ItemStatus; owner: string | null; due_date: string | null;
  evidence_path: string | null; note: string | null; watch_out: string | null; sort: number;
}
export interface GateOverride extends Base { tracker_id: string; stage_no: number; reason: string; by: string | null; at: string }
export interface Watchout extends Base { text: string; stage_no: number | null; category: string | null; learned_from_market_id: string | null }
export interface MarketWatchNote extends Base {
  market_id: string; headline: string; source: string | null; source_url: string | null; published_on: string | null; impact: string | null;
  flags: { play_ids?: string[]; gate_ids?: string[]; status_change?: string | null };
}
export interface GlossaryRow extends Base { key: string; label: string; meaning: string; formula_text: string | null; unit: string | null }
export interface FxRateRow extends Base { base: string; quote: string; rate: number; month: string; tag: Tag; source: string | null }
export interface SetupSnapshot extends Base { principal_id: string; step: number | null; snapshot: unknown; taken_at: string }
export interface DocumentRow extends Base { entity_type: string; entity_id: string; kind: string | null; name: string | null; path: string; uploaded_at: string }

export interface Tables {
  allowed_users: AllowedUser;
  settings: Setting;
  tracked_values: TrackedValue;
  principals: Principal;
  principal_fee_terms: PrincipalFeeTerm;
  brands: Brand;
  product_families: ProductFamily;
  sku_configs: SkuConfig;
  pack_levels: PackLevelRow;
  production_sites: ProductionSite;
  markets: Market;
  positioning: Positioning;
  market_listings: MarketListing;
  market_areas: MarketArea;
  segments: Segment;
  channels: Channel;
  sku_prices: SkuPrice;
  channel_terms: ChannelTerms;
  accounts: Account;
  sales_records: SalesRecord;
  orders: Order;
  cost_lines: CostLine;
  sc_nodes: ScNode;
  sc_lanes: ScLane;
  trade_rules: TradeRuleRow;
  compliance_gates: ComplianceGate;
  shelf_observations: ShelfObservation;
  competitor_brands: CompetitorBrand;
  partner_roles: PartnerRole;
  partners: Partner;
  terms_benchmarks: TermsBenchmark;
  partner_asks: PartnerAsk;
  market_evidence: MarketEvidence;
  plays: Play;
  scenarios: Scenario;
  stage_templates: StageTemplate;
  stage_items_template: StageItemTemplate;
  stage_trackers: StageTracker;
  stage_items: StageItem;
  gate_overrides: GateOverride;
  watchouts: Watchout;
  market_watch_notes: MarketWatchNote;
  glossary: GlossaryRow;
  fx_rates: FxRateRow;
  setup_snapshots: SetupSnapshot;
  documents: DocumentRow;
}

export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];
export type Dataset = { [K in TableName]: Row<K>[] };

/** Tables whose primary key is not `id`. */
export const KEY_COLUMN: Partial<Record<TableName, string>> = { allowed_users: 'email', settings: 'key' };

/** Insert order respecting foreign keys (used by the seed script). */
export const TABLE_ORDER: TableName[] = [
  'allowed_users', 'settings', 'glossary', 'fx_rates', 'markets', 'principals', 'principal_fee_terms', 'brands', 'product_families',
  'sku_configs', 'pack_levels', 'production_sites', 'positioning', 'market_listings', 'market_areas', 'segments', 'channels',
  'sku_prices', 'channel_terms', 'accounts', 'sales_records', 'orders', 'cost_lines', 'sc_nodes', 'sc_lanes', 'trade_rules',
  'compliance_gates', 'shelf_observations', 'competitor_brands', 'partner_roles', 'partners', 'terms_benchmarks', 'partner_asks',
  'market_evidence', 'plays', 'scenarios', 'stage_templates', 'stage_items_template', 'stage_trackers', 'stage_items',
  'gate_overrides', 'watchouts', 'market_watch_notes', 'setup_snapshots', 'documents', 'tracked_values',
];
