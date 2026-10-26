import { describe, expect, it } from 'vitest';
import { buildSeed } from '@/lib/seed/build';
import { datasetToSql } from '@/lib/seed/sql';
import { currentStage, gateStates } from '@/lib/stages';
import { assessable } from './helpers';

const d = buildSeed();
const market = (iso: string) => d.markets.find((m) => m.iso2 === iso)!;
const tracker = (iso: string) => d.stage_trackers.find((t) => t.market_id === market(iso).id)!;
const items = (iso: string) => d.stage_items.filter((i) => i.tracker_id === tracker(iso).id);
const status = (iso: string, item: string) => items(iso).find((i) => i.item === item)?.status;

describe('seed (spec §12)', () => {
  it('is deterministic', () => {
    expect(buildSeed().markets.map((m) => m.id)).toEqual(d.markets.map((m) => m.id));
  });

  it('markets: SG active, MY exploring, MM paused with blocker and alt routes', () => {
    expect(market('SG').status).toBe('active');
    expect(market('MY').status).toBe('exploring');
    expect(market('MM').status).toBe('paused');
    expect(market('MM').blocker).toMatch(/import licence/i);
    expect(market('MM').alt_routes).toHaveLength(2);
  });

  it('every numeric figure has a tag, and public/estimated/measured ones carry a source', () => {
    for (const v of d.tracked_values) {
      expect(v.tag).toBeTruthy();
      if (['public', 'measured'].includes(v.tag) && (v.value_num != null || v.value_text)) expect(v.source_label, `${v.label} needs a source`).toBeTruthy();
    }
  });

  it('keeps conflicting NSK outlet counts as two separately sourced values', () => {
    const nsk = d.channels.find((c) => c.name === 'NSK Trade City')!;
    const vals = d.tracked_values.filter((v) => v.entity_id === nsk.id && v.field.startsWith('outlet_count'));
    expect(vals.map((v) => v.value_num).sort()).toEqual([17, 30]);
    expect(new Set(vals.map((v) => v.source_label)).size).toBe(2);
  });

  it('Malaysia tracker statuses match §12.3', () => {
    expect(status('MY', 'Seed numbers reviewed')).toBe('done');
    expect(status('MY', 'Tariff line and import tax confirmed per SKU')).toBe('in_progress');
    expect(status('MY', 'Licence and foreign-ownership blockers checked')).toBe('in_progress');
    expect(status('MY', 'Market scorecard filled')).toBe('not_started');
    expect(status('MY', 'Competitor cards written (with "how we win")')).toBe('in_progress');
    expect(status('MY', 'NSK discussion')).toBe('in_progress');
    expect(status('MY', 'Certifications planned (e.g. halal)')).toBe('in_progress');
    expect(status('MY', 'Store audit across outlet tiers')).toBe('not_started');
  });

  it('Myanmar tracker statuses match §12.6 and are flagged for the owner', () => {
    for (const it of ['Store audit across outlet tiers', 'Price bands and target shelf price set', 'Competitor cards written (with "how we win")', "Range-gap check vs rivals' pack sizes"]) expect(status('MM', it)).toBe('done');
    expect(status('MM', '≥2 candidates scored per chosen role')).toBe('in_progress');
    expect(status('MM', 'Import licence route')).toBe('blocked');
    expect(items('MM').filter((i) => i.status !== 'not_started').every((i) => /owner to confirm/i.test(i.note ?? ''))).toBe(true);
    expect(d.watchouts.some((w) => w.text === 'Check the import licence route before investing in field work.')).toBe(true);
  });

  it('gate logic: required open items lock a gate; an override passes it', () => {
    const its = items('MY');
    expect(currentStage(its, [])).toBe(1);
    const override = { id: 'o', tracker_id: tracker('MY').id, stage_no: 1, reason: 'test', by: 'x', at: '', created_at: '', updated_at: '', created_by: null };
    expect(currentStage(its, [override])).toBe(2);
    expect(gateStates(its, []).find((g) => g.stage === 1)!.openRequired.length).toBe(3);
  });

  it('Golden Land 15% margin ask is above its benchmark', () => {
    expect(assessable(d, 'Golden Land Trading Co., Ltd')).toBe('above');
  });

  it('competitor cards all have "how we win"', () => {
    expect(d.competitor_brands).toHaveLength(4);
    expect(d.competitor_brands.every((c) => c.how_we_win.trim().length > 0)).toBe(true);
  });

  it('every node keeps lat/lng for the future globe', () => {
    expect(d.sc_nodes.length).toBeGreaterThan(0);
    expect(d.sc_nodes.every((n) => n.lat != null && n.lng != null)).toBe(true);
  });

  it('renders SQL for every non-empty table', () => {
    const sql = datasetToSql(d);
    expect(sql).toContain('insert into tracked_values');
    expect(sql).toContain("'{\"full-service distributor holding licence\",\"local co-packing / licensed manufacture\"}'");
  });
});
