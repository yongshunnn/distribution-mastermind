import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { byId } from '@/lib/db/data';
import { PrincipalTabs } from './tabs';

export default async function PrincipalLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await byId('principals', id);
  if (!p) notFound();
  return (
    <div>
      <PageHeader back={{ href: '/principals', label: 'Principals' }} title={p.name} subtitle={`${p.country ?? '—'} · ${p.contract_type?.replace('_', ' ') ?? 'contract type to confirm'} · territories ${p.territories.join(', ') || '—'}`} />
      <PrincipalTabs id={p.id} />
      {children}
    </div>
  );
}
