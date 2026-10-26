'use client';

import { usePathname } from 'next/navigation';
import { Tabs } from '@/components/ui';

const TABS = [
  ['', 'Overview'], ['stages', 'Stages'], ['channels', 'Channels & segments'], ['competition', 'Competition'],
  ['trade', 'Trade & compliance'], ['partners', 'Partners'], ['routes', 'Routes'], ['data', 'Data'],
] as const;

export function MarketTabs({ id }: { id: string }) {
  const path = usePathname();
  const active = path.split('/')[3] ?? '';
  return <Tabs active={active} tabs={TABS.map(([k, label]) => ({ key: k, label, href: `/markets/${id}${k ? `/${k}` : ''}` }))} />;
}
