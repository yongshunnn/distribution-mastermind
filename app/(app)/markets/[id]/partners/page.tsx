import { notFound } from 'next/navigation';
import { AddPartnerForm, PartnerList } from '@/components/partner-list';
import { ButtonLink } from '@/components/ui';
import { byId, rows } from '@/lib/db/data';

export const metadata = { title: 'Market partners' };

export default async function MarketPartners({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const [partners, asks, benchmarks, roles, markets, principals] = await Promise.all([rows('partners'), rows('partner_asks'), rows('terms_benchmarks'), rows('partner_roles'), rows('markets'), rows('principals')]);
  return (
    <div className="space-y-4">
      <PartnerList partners={partners.filter((p) => p.market_id === m.id)} asks={asks} benchmarks={benchmarks} roles={roles} markets={markets} />
      <AddPartnerForm marketId={m.id} markets={markets} roles={roles} />
      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/proposal?market=${m.id}&principal=${principals[0]?.id ?? ''}&role=distributor`}>Draft a distributor proposal</ButtonLink>
        <ButtonLink href={`/proposal?market=${m.id}&principal=${principals[0]?.id ?? ''}&role=full_service_distributor`}>Full-service proposal</ButtonLink>
      </div>
    </div>
  );
}
