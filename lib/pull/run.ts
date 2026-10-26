import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** A value pulled from a public source. Lands as tag 'public' with source and date (spec §14 milestone 9). */
export interface Pulled {
  entity_type: string;
  entity_id: string;
  field: string;
  label: string;
  value_num: number;
  unit: string;
  source_label: string;
  source_url: string;
  as_of: string;
}

export interface PullResult {
  written: string[];
  skipped: string[];
}

/** Writes pulled values, but never replaces a value someone has marked measured or quoted. */
export async function writePulled(svc: SupabaseClient, values: Pulled[]): Promise<PullResult> {
  const res: PullResult = { written: [], skipped: [] };
  for (const v of values) {
    const { data: cur } = await svc
      .from('tracked_values')
      .select('tag, value_num, as_of')
      .eq('entity_type', v.entity_type).eq('entity_id', v.entity_id).eq('field', v.field).eq('is_current', true)
      .maybeSingle();
    if (cur && (cur.tag === 'measured' || cur.tag === 'quoted')) {
      res.skipped.push(`${v.field}: current value is ${cur.tag}`);
      continue;
    }
    if (cur && Number(cur.value_num) === v.value_num && cur.as_of === v.as_of) {
      res.skipped.push(`${v.field}: unchanged`);
      continue;
    }
    const { error } = await svc.rpc('set_tracked_value', {
      p_entity_type: v.entity_type, p_entity_id: v.entity_id, p_field: v.field, p_value_num: v.value_num, p_value_text: null,
      p_unit: v.unit, p_tag: 'public', p_source_label: v.source_label, p_source_url: v.source_url, p_as_of: v.as_of, p_note: 'Pulled automatically', p_label: v.label,
    });
    if (error) res.skipped.push(`${v.field}: ${error.message}`);
    else res.written.push(v.field);
  }
  return res;
}
