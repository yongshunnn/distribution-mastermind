import { Card, PageHeader } from '@/components/ui';
import { AddPartnerForm, PartnerList } from '@/components/partner-list';
import { rows } from '@/lib/db/data';

export const metadata = { title: 'Partners' };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ market?: string; role?: string }> }) {
  const sp = await searchParams;
  const [partners, asks, benchmarks, roles, markets] = await Promise.all([rows('partners'), rows('partner_asks'), rows('terms_benchmarks'), rows('partner_roles'), rows('markets')]);
  const shown = partners.filter((p) => (!sp.market || p.market_id === sp.market) && (!sp.role || p.roles.includes(sp.role as never)));
  return (
    <div className="space-y-4">
      <PageHeader title="Partners" subtitle="Directory across markets. Asks outside the terms benchmark are flagged red, with the benchmark's source." />
      <form method="get" className="flex flex-wrap gap-2">
        <select name="market" defaultValue={sp.market ?? ''} className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm" aria-label="Market">
          <option value="">All markets</option>
          {markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select name="role" defaultValue={sp.role ?? ''} className="min-h-11 rounded-lg border border-border bg-card px-3 text-sm" aria-label="Role">
          <option value="">All roles</option>
          {roles.map((r) => <option key={r.role} value={r.role}>{r.label}</option>)}
        </select>
        <button className="min-h-11 rounded-lg border border-border px-4 text-sm">Filter</button>
      </form>
      <PartnerList partners={shown} asks={asks} benchmarks={benchmarks} roles={roles} markets={markets} />
      <Card className="p-0"><AddPartnerForm markets={markets} roles={roles} marketId={sp.market} /></Card>
    </div>
  );
}
