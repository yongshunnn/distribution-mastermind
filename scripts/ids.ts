import { buildSeed } from '@/lib/seed/build';
const d = buildSeed();
const m = (iso: string) => d.markets.find((x) => x.iso2 === iso)!.id;
console.log(JSON.stringify({
  SG: m('SG'), MY: m('MY'), MM: m('MM'),
  principal: d.principals[0].id,
  plays: Object.fromEntries(d.plays.map((p) => [p.name, p.id])),
  partner: d.partners.find((p) => p.name.startsWith('Golden'))!.id,
  scenario: d.scenarios[0].id,
}));
