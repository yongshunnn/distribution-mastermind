import { notFound } from 'next/navigation';
import { Badge, PageHeader } from '@/components/ui';
import { byId } from '@/lib/db/data';
import { MarketTabs } from './tabs';

export default async function MarketLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await byId('markets', id);
  if (!m) notFound();
  const tone = { active: 'ok', exploring: 'info', paused: 'warn' } as const;
  return (
    <div>
      <PageHeader
        back={{ href: '/markets', label: 'Markets' }}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {m.name} <Badge tone={tone[m.status]}>{m.status}</Badge>
          </span>
        }
        subtitle={`${m.currency} · ${m.vat_name ?? 'tax n/a'}${m.blocker ? ` · Blocker: ${m.blocker}` : ''}`}
      />
      <MarketTabs id={m.id} />
      {children}
    </div>
  );
}
