-- Distribution Mastermind — core schema (spec §5)
-- One workspace. Access = authenticated user whose email is in allowed_users.

create extension if not exists pgcrypto;

-- ───────────────────────────── enums ─────────────────────────────
create type value_tag as enum ('public','estimated','placeholder','quoted','measured','computed');
create type contract_type as enum ('exclusive_distribution','agency','trade_services');
create type fee_model as enum ('retainer','commission','profit_share');
create type pack_level as enum ('each','inner','carton','pallet','container');
create type price_type as enum ('supplier_exw','fob','list','shelf');
create type market_status as enum ('active','exploring','paused');
create type channel_type as enum ('retail_chain','b2b_platform','distributor','wholesale','direct_van','ecommerce');
create type sales_source as enum ('actual','principal_reported');
create type node_type as enum ('factory','origin_port','dest_port','importer_wh','bonded_wh','distributor_wh','3pl','retail_dc','outlet','consumer');
create type lane_mode as enum ('truck','sea_fcl','sea_lcl','air','courier');
create type route_type as enum ('importer_of_record','distributor','full_service_distributor','co_packer','b2b_platform','retail_chain','own_entry');
create type item_status as enum ('not_started','in_progress','done','not_needed','blocked');
create type origin_kind as enum ('local','imported');

-- ─────────────────────── access / workspace ───────────────────────
create table allowed_users (
  email text primary key,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

-- True when the signed-in user's email is on the allowlist (= workspace member).
create or replace function is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from allowed_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Callable by anon so the login page can refuse non-allowlisted emails before sending a link.
create or replace function is_email_allowed(p_email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from allowed_users where lower(email) = lower(p_email));
$$;

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── tracked values ─────────────────────────
create table tracked_values (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field text not null,
  label text,
  value_num numeric,
  value_text text,
  unit text,
  tag value_tag not null,
  source_label text,
  source_url text,
  as_of date,
  note text,
  is_current boolean not null default true,
  replaced_by uuid references tracked_values(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index tracked_values_current_idx on tracked_values (entity_type, entity_id, field) where is_current;
create unique index tracked_values_one_current on tracked_values (entity_type, entity_id, field) where is_current;

-- Edit = insert new row, flip previous current row to history.
create or replace function set_tracked_value(
  p_entity_type text, p_entity_id uuid, p_field text,
  p_value_num numeric, p_value_text text, p_unit text, p_tag value_tag,
  p_source_label text default null, p_source_url text default null, p_as_of date default null,
  p_note text default null, p_label text default null
) returns tracked_values
language plpgsql security invoker set search_path = public as $$
declare
  v_old tracked_values;
  v_new tracked_values;
begin
  select * into v_old from tracked_values
   where entity_type = p_entity_type and entity_id = p_entity_id and field = p_field and is_current
   for update;
  if found then
    update tracked_values set is_current = false where id = v_old.id;
  end if;
  insert into tracked_values (entity_type, entity_id, field, label, value_num, value_text, unit, tag,
                              source_label, source_url, as_of, note, is_current)
  values (p_entity_type, p_entity_id, p_field, coalesce(p_label, v_old.label), p_value_num, p_value_text,
          coalesce(p_unit, v_old.unit), p_tag, p_source_label, p_source_url, p_as_of, p_note, true)
  returning * into v_new;
  if v_old.id is not null then
    update tracked_values set replaced_by = v_new.id where id = v_old.id;
  end if;
  return v_new;
end;
$$;

-- ───────────────────────── principals & products ─────────────────────────
create table principals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  contact text,
  contract_type contract_type,
  territories text[] not null default '{}',
  exclusivity text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table principal_fee_terms (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references principals(id) on delete cascade,
  model fee_model not null,
  basis text,                    -- 'monthly' | 'net_sales' | 'market_npat_after_payback'
  currency text not null default 'SGD',
  start_date date,
  end_date date,
  -- amount_or_pct lives in tracked_values (entity_type 'principal_fee_terms', field 'amount_or_pct')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table brands (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references principals(id) on delete cascade,
  name text not null,
  origin_claim text,
  story text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table product_families (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  category text,
  base_formulation text,
  certifications text[] not null default '{}',
  hs_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table sku_configs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references product_families(id) on delete cascade,
  sku_code text not null unique,
  name text,
  variant_attrs jsonb not null default '{}',   -- size_ml, scent, formulation, pack_count…
  barcode text,
  shelf_life_days int,
  overrides jsonb not null default '{}',       -- only what differs from the family
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table pack_levels (
  id uuid primary key default gen_random_uuid(),
  sku_config_id uuid not null references sku_configs(id) on delete cascade,
  level pack_level not null,
  units_per_level numeric not null,
  l_cm numeric, w_cm numeric, h_cm numeric,
  gross_kg numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (sku_config_id, level)
);

create table production_sites (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references principals(id) on delete cascade,
  name text not null,
  country text,
  lat double precision, lng double precision,
  capacity text,
  moq text,
  lead_time_days int,
  incoterm text,
  currency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── markets ─────────────────────────
create table markets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  iso2 text not null unique,
  currency text not null,
  vat_name text,
  status market_status not null default 'exploring',
  blocker text,
  alt_routes text[] not null default '{}',
  lat double precision, lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table positioning (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  market_id uuid not null references markets(id) on delete cascade,
  master_positioning text,
  sub_line text,
  claims text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table market_listings (
  id uuid primary key default gen_random_uuid(),
  sku_config_id uuid not null references sku_configs(id) on delete cascade,
  market_id uuid not null references markets(id) on delete cascade,
  label_language text,
  registration_status text,
  halal_status text,
  local_item_code text,
  label_file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (sku_config_id, market_id)
);

create table market_areas (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  name text not null,
  -- population, households → tracked_values
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table segments (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  outlet_type text not null,
  area_id uuid references market_areas(id) on delete set null,
  -- outlet_count, usage_per_outlet_month → tracked_values
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table channels (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  name text not null,
  channel_type channel_type not null,
  segment_ids uuid[] not null default '{}',
  has_distributor_tier boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table sku_prices (
  id uuid primary key default gen_random_uuid(),
  sku_config_id uuid not null references sku_configs(id) on delete cascade,
  market_id uuid references markets(id) on delete cascade,
  channel_id uuid references channels(id) on delete cascade,
  price_type price_type not null,
  currency text not null,
  -- value → tracked_values (entity_type 'sku_price', field 'price')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table channel_terms (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  principal_id uuid references principals(id) on delete cascade,
  delivery_mode text,
  -- margin, rebate, listing_fee, payment_days, returns_pct … → tracked_values
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table accounts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table sales_records (
  id uuid primary key default gen_random_uuid(),
  sku_config_id uuid not null references sku_configs(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  market_id uuid not null references markets(id) on delete cascade,
  month date not null,
  units numeric,
  value numeric,
  currency text,
  source sales_source not null default 'principal_reported',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- Phase 2+ (kept minimal)
create table orders (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id) on delete cascade,
  channel_id uuid references channels(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  ordered_on date,
  status text,
  lines jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table cost_lines (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  kind text not null,          -- freight | warehouse | promotion | delivery …
  amount numeric,
  currency text,
  incurred_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── supply chain ─────────────────────────
create table sc_nodes (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid references principals(id) on delete cascade,
  name text not null,
  node_type node_type not null,
  market_id uuid references markets(id) on delete cascade,
  lat double precision, lng double precision,
  stock_days numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table sc_lanes (
  id uuid primary key default gen_random_uuid(),
  from_node uuid not null references sc_nodes(id) on delete cascade,
  to_node uuid not null references sc_nodes(id) on delete cascade,
  mode lane_mode not null,
  lead_time_days numeric,
  cost_per_unit numeric,
  cost_per_m3 numeric,
  currency text,
  payer text,
  tag value_tag not null default 'placeholder',
  source_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── trade & compliance ─────────────────────────
create table trade_rules (
  id uuid primary key default gen_random_uuid(),
  hs_code text not null,
  origin_iso2 text,             -- null = any origin
  dest_iso2 text not null,
  regime text not null,         -- MFN | ATIGA | ACFTA | RCEP …
  coo_form text,                -- e.g. 'Form D', 'Form E'; null for MFN
  source text,
  -- duty_pct → tracked_values (entity_type 'trade_rule', field 'duty_pct')
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table compliance_gates (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  product_family_id uuid references product_families(id) on delete set null,
  requirement text not null,
  detail text,
  authority text,
  deadline date,
  status text not null default 'open',
  tag value_tag not null default 'estimated',
  source text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── competition ─────────────────────────
create table shelf_observations (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  category text not null default 'dishwashing',
  outlet_name text,
  outlet_tier text,
  area_id uuid references market_areas(id) on delete set null,
  observed_on date not null default current_date,
  brand text not null,
  owner text,
  pack_size numeric not null,
  pack_unit text not null,       -- ml | l | g | kg
  price numeric not null,
  currency text not null,
  facings int,
  attributes jsonb not null default '{}',   -- scent, claim, halal_logo, label_langs
  origin origin_kind,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table competitor_brands (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  category text not null default 'dishwashing',
  brand text not null,
  owner text,
  pack_sizes text[] not null default '{}',
  positioning text,
  structural_strength text,
  weakness text,
  how_we_win text not null check (length(trim(how_we_win)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── partners ─────────────────────────
create table partner_roles (
  id uuid primary key default gen_random_uuid(),
  role route_type not null unique,
  label text not null,
  what_partner_brings text,
  what_we_bring text,
  commercial_framework text,
  what_we_ask_first text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table partners (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id) on delete cascade,
  name text not null,
  roles route_type[] not null default '{}',
  reach text,
  competing_lines text,
  contact text,
  deal_stage text not null default 'identified',
  score numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table terms_benchmarks (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references markets(id) on delete cascade,   -- null = any market
  role text not null,
  metric text not null,          -- gross_margin | incentive | credit_days | review_cadence | exclusivity_rule | term_months
  low numeric,
  high numeric,
  text_value text,               -- for non-numeric rules (review cadence, exclusivity rule)
  unit text,
  tag value_tag not null default 'estimated',
  source text,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table partner_asks (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  metric text not null,
  value numeric,
  value_text text,
  unit text,
  asked_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table market_evidence (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  statement text not null,
  value text,
  tag value_tag not null default 'public',
  source text,
  source_url text,
  as_of date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── plays & scenarios ─────────────────────────
create table plays (
  id uuid primary key default gen_random_uuid(),
  name text,
  sku_config_id uuid not null references sku_configs(id) on delete cascade,
  channel_id uuid not null references channels(id) on delete cascade,
  segment_id uuid references segments(id) on delete set null,
  market_id uuid not null references markets(id) on delete cascade,
  route_type route_type not null,
  status text not null default 'draft',
  -- q_realistic_month, entry_cost and per-play cost inputs → tracked_values (entity_type 'play')
  assumption_overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  play_ids uuid[] not null default '{}',
  limits jsonb not null default '{}',     -- capital, wc_limit, people, pallets
  overrides jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── stages ─────────────────────────
create table stage_templates (
  id uuid primary key default gen_random_uuid(),
  stage_no int not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table stage_items_template (
  id uuid primary key default gen_random_uuid(),
  stage_no int not null,
  item text not null,
  required boolean not null default false,
  watch_out text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table stage_trackers (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  principal_id uuid not null references principals(id) on delete cascade,
  kind text not null default 'entry',   -- entry | expansion
  scope text,                           -- e.g. 'New channel: hotels'
  parent_tracker_id uuid references stage_trackers(id) on delete set null,
  current_stage int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table stage_items (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references stage_trackers(id) on delete cascade,
  stage_no int not null,
  item text not null,
  required boolean not null default false,
  status item_status not null default 'not_started',
  owner text,
  due_date date,
  evidence_path text,
  note text,
  watch_out text,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table gate_overrides (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references stage_trackers(id) on delete cascade,
  stage_no int not null,
  reason text not null check (length(trim(reason)) > 0),
  by text,
  at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table watchouts (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  stage_no int,
  category text,
  learned_from_market_id uuid references markets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table market_watch_notes (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references markets(id) on delete cascade,
  headline text not null,
  source text,
  source_url text,
  published_on date,
  impact text,
  flags jsonb not null default '{}',    -- { play_ids: [], gate_ids: [], status_change: 'paused' }
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ───────────────────────── reference ─────────────────────────
create table glossary (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  meaning text not null,
  formula_text text,
  unit text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table fx_rates (
  id uuid primary key default gen_random_uuid(),
  base text not null,
  quote text not null,
  rate numeric not null,        -- 1 base = rate quote
  month date not null,
  tag value_tag not null default 'public',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (base, quote, month)
);

create table setup_snapshots (
  id uuid primary key default gen_random_uuid(),
  principal_id uuid not null references principals(id) on delete cascade,
  step int,
  snapshot jsonb not null,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  kind text,
  name text,
  path text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

-- ─────────────── updated_at trigger + RLS on every table ───────────────
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('create trigger %I before update on %I for each row execute function touch_updated_at()',
                     t || '_touch', t);
    end if;
    if t = 'allowed_users' then
      -- members can see the allowlist; changes go through the service role / SQL editor
      execute format('create policy members_read on %I for select to authenticated using (is_member())', t);
    else
      execute format('create policy members_all on %I for all to authenticated using (is_member()) with check (is_member())', t);
    end if;
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant execute on function is_email_allowed(text) to anon, authenticated;
grant execute on function set_tracked_value(text, uuid, text, numeric, text, text, value_tag, text, text, date, text, text) to authenticated;
