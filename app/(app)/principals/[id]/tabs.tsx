'use client';

import { usePathname } from 'next/navigation';
import { Tabs } from '@/components/ui';

const TABS = [['', 'Overview'], ['setup', 'Setup wizard'], ['catalogue', 'Catalogue'], ['contracts', 'Contract & fees'], ['pnl', 'P&L'], ['supply-chain', 'Supply chain']] as const;

export function PrincipalTabs({ id }: { id: string }) {
  const path = usePathname();
  const active = path.split('/')[3] ?? '';
  return <Tabs active={active} tabs={TABS.map(([k, label]) => ({ key: k, label, href: `/principals/${id}${k ? `/${k}` : ''}` }))} />;
}
