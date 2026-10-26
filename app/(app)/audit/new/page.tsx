import { PageHeader } from '@/components/ui';
import { rows } from '@/lib/db/data';
import { AuditForm } from './audit-form';

export const metadata = { title: 'Store audit' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ market?: string }> }) {
  const sp = await searchParams;
  const [markets, areas] = await Promise.all([rows('markets'), rows('market_areas')]);
  return (
    <div>
      <PageHeader title="Store audit" subtitle="One shelf facing at a time. Outlet details stay filled in between entries. Works offline — entries queue and send when you are back online." />
      <AuditForm
        markets={markets.map((m) => ({ id: m.id, name: m.name, currency: m.currency }))}
        areas={areas.map((a) => ({ id: a.id, name: a.name, market_id: a.market_id }))}
        defaultMarket={sp.market ?? markets.find((m) => m.status === 'exploring')?.id ?? markets[0]?.id}
        today={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
