import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { writePulled, type Pulled, type PullResult } from './run';

// NOTE: these pullers were written without network access to the source APIs (blocked in the build sandbox).
// Each one validates the response shape and writes nothing if it does not match. Check the logs after the first run.

const SG_OUTLETS_DATASET = 'd_a9e81ab29216b10b69e23e7957b680b9';
const SG_SEGMENT_MATCH: Record<string, RegExp> = {
  Supermarkets: /supermarket/i,
  'Food shops': /food\s*shop/i,
  'Food stalls': /food\s*stall/i,
  'Non-retail food establishments': /non.?retail/i,
  'NEA hawker stalls': /hawker/i,
};

/** data.gov.sg licensed food establishments — refreshes Singapore segment outlet counts. */
async function sgOutlets(svc: SupabaseClient): Promise<PullResult> {
  const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${SG_OUTLETS_DATASET}&limit=500`;
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return { written: [], skipped: [`HTTP ${r.status}`] };
  const json = (await r.json()) as { result?: { records?: Record<string, unknown>[] } };
  const records = json.result?.records;
  if (!Array.isArray(records) || !records.length) return { written: [], skipped: ['unexpected response shape'] };
  const { data: market } = await svc.from('markets').select('id').eq('iso2', 'SG').maybeSingle();
  if (!market) return { written: [], skipped: ['no SG market'] };
  const { data: segments } = await svc.from('segments').select('id, outlet_type').eq('market_id', market.id);
  const out: Pulled[] = [];
  for (const seg of segments ?? []) {
    const re = SG_SEGMENT_MATCH[seg.outlet_type];
    if (!re) continue;
    // Records are expected to be one row per establishment type with year columns; take the latest year present.
    const row = records.find((rec) => Object.values(rec).some((v) => typeof v === 'string' && re.test(v)));
    if (!row) continue;
    const years = Object.keys(row).filter((k) => /^\d{4}$/.test(k)).sort();
    const year = years[years.length - 1];
    const value = year ? Number(String(row[year]).replace(/,/g, '')) : NaN;
    if (!Number.isFinite(value)) continue;
    out.push({ entity_type: 'segment', entity_id: seg.id, field: 'outlet_count', label: `${seg.outlet_type} (${year})`, value_num: value, unit: 'outlets', source_label: 'data.gov.sg', source_url: `https://data.gov.sg/datasets/${SG_OUTLETS_DATASET}/view`, as_of: `${year}-12-31` });
  }
  if (!out.length) return { written: [], skipped: ['no matching rows — check dataset columns'] };
  return writePulled(svc, out);
}

/** UN Comtrade imports for HS 3402 per market (needs COMTRADE_API_KEY). */
async function comtrade(svc: SupabaseClient): Promise<PullResult> {
  const key = process.env.COMTRADE_API_KEY;
  if (!key) return { written: [], skipped: ['COMTRADE_API_KEY not set'] };
  const reporters: Record<string, string> = { MY: '458', SG: '702', MM: '104' };
  const year = new Date().getFullYear() - 2;
  const out: Pulled[] = [];
  const { data: markets } = await svc.from('markets').select('id, iso2');
  for (const m of markets ?? []) {
    const code = reporters[m.iso2];
    if (!code) continue;
    const url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=${code}&period=${year}&cmdCode=3402&flowCode=M&partnerCode=0`;
    const r = await fetch(url, { headers: { 'Ocp-Apim-Subscription-Key': key }, cache: 'no-store' });
    if (!r.ok) continue;
    const json = (await r.json()) as { data?: { primaryValue?: number }[] };
    const v = json.data?.[0]?.primaryValue;
    if (typeof v !== 'number') continue;
    out.push({ entity_type: 'market', entity_id: m.id, field: 'hs3402_imports_usd', label: `Imports HS 3402 (${year})`, value_num: v, unit: 'USD', source_label: 'UN Comtrade', source_url: 'https://comtradeplus.un.org/', as_of: `${year}-12-31` });
  }
  return out.length ? writePulled(svc, out) : { written: [], skipped: ['no data returned'] };
}

export const JOBS: Record<string, (svc: SupabaseClient) => Promise<PullResult>> = {
  'sg-outlets': sgOutlets,
  comtrade,
};
