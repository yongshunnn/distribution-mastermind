// Duty lookup by HS code × origin × destination × regime (spec §8.1).
import { leaf, type Tag, type Traced } from './traced';

export interface TradeRule {
  id: string;
  hs_code: string;
  origin_iso2: string | null;
  dest_iso2: string;
  regime: string;
  coo_form: string | null;
  duty_pct: number; // percent, e.g. 5 for 5%
  tag: Tag;
  source?: string | null;
  source_url?: string | null;
  as_of?: string | null;
}

function hsMatches(ruleHs: string, hs: string): boolean {
  const a = ruleHs.replace(/\D/g, '');
  const b = hs.replace(/\D/g, '');
  return b.startsWith(a) || a.startsWith(b);
}

/**
 * Picks the duty rule. A preferential regime applies only when we hold its certificate of origin
 * (cooForms); otherwise MFN. The most specific HS match wins; among preferential options the lowest rate.
 */
export function pickDutyRule(
  rules: TradeRule[],
  hs: string,
  origin: string,
  dest: string,
  cooForms: string[] = [],
): TradeRule | undefined {
  const candidates = rules
    .filter((r) => r.dest_iso2 === dest && hsMatches(r.hs_code, hs))
    .filter((r) => !r.origin_iso2 || r.origin_iso2 === origin);
  const specificity = (r: TradeRule) => r.hs_code.replace(/\D/g, '').length;
  const preferential = candidates
    .filter((r) => r.regime !== 'MFN' && r.coo_form && cooForms.includes(r.coo_form))
    .sort((a, b) => a.duty_pct - b.duty_pct || specificity(b) - specificity(a));
  if (preferential.length) return preferential[0];
  return candidates.filter((r) => r.regime === 'MFN').sort((a, b) => specificity(b) - specificity(a))[0];
}

export function dutyRate(rules: TradeRule[], hs: string, origin: string, dest: string, cooForms: string[] = []): Traced {
  if (origin === dest) {
    return leaf('duty_rate', 0, '%', { tag: 'computed', label: 'Duty rate', note: 'Domestic supply — no import duty.' });
  }
  const r = pickDutyRule(rules, hs, origin, dest, cooForms);
  if (!r) {
    return leaf('duty_rate', 0, '%', {
      tag: 'placeholder',
      label: 'Duty rate',
      note: `No trade rule found for HS ${hs} ${origin} → ${dest}. Add one under Market → Trade & compliance.`,
    });
  }
  return leaf('duty_rate', r.duty_pct / 100, '%', {
    tag: r.tag,
    label: `Duty rate (${r.regime}${r.coo_form ? `, ${r.coo_form}` : ''})`,
    source: r.source ? { label: r.source, url: r.source_url ?? undefined, asOf: r.as_of ?? undefined } : undefined,
    ref: { entityType: 'trade_rule', entityId: r.id, field: 'duty_pct' },
    note: r.regime === 'MFN' && cooForms.length === 0 ? 'MFN applied — no certificate of origin on file for this play.' : undefined,
  });
}
