import 'server-only';
import { rows } from '@/lib/db/data';
import { metricLabel } from '@/lib/db/partners';

/** Partner-role proposal as Markdown (spec §10), mirroring the Myanmar partnership proposal's structure. */
export async function buildProposal(opts: { principalId: string; marketId: string; role: string; partnerId?: string }): Promise<{ title: string; markdown: string } | null> {
  const [principals, brands, markets, evidence, positioning, roles, benchmarks, partners, families, skus, competitors] = await Promise.all([
    rows('principals'), rows('brands'), rows('markets'), rows('market_evidence'), rows('positioning'), rows('partner_roles'), rows('terms_benchmarks'),
    rows('partners'), rows('product_families'), rows('sku_configs'), rows('competitor_brands'),
  ]);
  const principal = principals.find((p) => p.id === opts.principalId);
  const market = markets.find((m) => m.id === opts.marketId);
  const role = roles.find((r) => r.role === opts.role);
  if (!principal || !market || !role) return null;
  const brand = brands.find((b) => b.principal_id === principal.id);
  const partner = partners.find((p) => p.id === opts.partnerId);
  const pos = positioning.find((p) => p.market_id === market.id && p.brand_id === brand?.id);
  const fams = families.filter((f) => f.brand_id === brand?.id);
  const roleWords = role.label.split(' ')[0].toLowerCase();
  const bms = benchmarks
    .filter((b) => (b.market_id === market.id || b.market_id === null) && (b.role.toLowerCase().includes(roleWords) || b.role === 'Any' || (roleWords === 'importer' && b.role.includes('Importer'))))
    .sort((a, b) => (a.market_id ? -1 : 1) - (b.market_id ? -1 : 1));
  const ev = evidence.filter((e) => e.market_id === market.id);
  const comp = competitors.filter((c) => c.market_id === market.id);
  const fmt = (b: (typeof bms)[number]) => {
    const u = b.unit === 'pct' ? '%' : b.unit ? ` ${b.unit}` : '';
    const v = b.low != null && b.high != null ? (b.low === b.high ? `${b.low}${u}` : `${b.low}–${b.high}${u}`) : (b.text_value ?? '');
    return `| ${metricLabel(b.metric)} | ${v} | ${b.source ?? ''}${b.market_id ? ` (${market.name})` : ''} |`;
  };
  const title = `${principal.name} × ${partner?.name ?? role.label} — ${market.name} partnership proposal`;
  const md = [
    `# ${title}`,
    '',
    `*Prepared ${new Date().toISOString().slice(0, 10)} · Draft for discussion · Figures are tagged estimates unless stated.*`,
    '',
    '## 1. Who we are',
    '',
    brand?.story ?? `${principal.name} is a brand owner represented by our distribution team.`,
    '',
    fams.length ? `**Range:** ${fams.map((f) => `${f.name} (${skus.filter((s) => s.family_id === f.id).map((s) => s.name ?? s.sku_code).join(', ')})`).join('; ')}.` : '',
    '',
    '## 2. The opportunity in ' + market.name,
    '',
    ...(ev.length ? ev.map((e) => `- ${e.statement}${e.source ? ` — *${e.source}${e.as_of ? `, ${e.as_of}` : ''}*` : ''}`) : ['- Market evidence to be added.']),
    '',
    '## 3. Positioning',
    '',
    pos?.master_positioning ? `**Master positioning:** ${pos.master_positioning}${pos.sub_line ? `\n\n**Sub-line:** ${pos.sub_line}` : ''}${pos.claims.length ? `\n\n**Claims:** ${pos.claims.join('; ')}` : ''}` : 'Positioning for this market to be confirmed.',
    '',
    ...(comp.length ? ['**How we win against the shelf leaders:**', '', ...comp.map((c) => `- *${c.brand}* (${c.owner}): ${c.how_we_win}`), ''] : []),
    `## 4. The role we propose: ${role.label}`,
    '',
    '| What you bring | What we bring |',
    '| --- | --- |',
    `| ${role.what_partner_brings ?? ''} | ${role.what_we_bring ?? ''} |`,
    '',
    '## 5. Commercial framework',
    '',
    role.commercial_framework ?? '',
    '',
    ...(bms.length ? ['| Term | Reference range | Basis |', '| --- | --- | --- |', ...bms.map(fmt), ''] : []),
    'Exclusivity is offered only against a minimum purchase commitment, with a review and termination trigger.',
    '',
    '## 6. What we need from you',
    '',
    ...(role.what_we_ask_first ?? '').split(/,\s*/).filter(Boolean).map((x) => `- ${x[0].toUpperCase()}${x.slice(1)}`),
    '',
    '## 7. Next steps',
    '',
    '1. Share the information above.',
    '2. Agree pricing, credit terms, KPIs and review cadence.',
    '3. Pilot order and joint launch plan.',
    '',
  ].join('\n');
  return { title, markdown: md };
}
