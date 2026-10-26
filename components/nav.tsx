'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChartLine, ClipboardList, FlaskConical, Globe, Handshake, House, Menu, Network, Newspaper, Package, Settings } from 'lucide-react';

export const PRIMARY = [
  { href: '/home', label: 'Home', icon: House },
  { href: '/plays', label: 'Plays', icon: ChartLine },
  { href: '/markets', label: 'Markets', icon: Globe },
  { href: '/principals', label: 'Principals', icon: Building2 },
];

export const SECONDARY = [
  { href: '/catalogue', label: 'Catalogue', icon: Package },
  { href: '/supply-chain', label: 'Supply chain', icon: Network },
  { href: '/partners', label: 'Partners', icon: Handshake },
  { href: '/scenarios', label: 'Scenarios', icon: FlaskConical },
  { href: '/watch', label: 'Market watch', icon: Newspaper },
  { href: '/audit/new', label: 'Store audit', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function isActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function BottomNav() {
  const path = usePathname();
  const moreActive = path === '/more' || SECONDARY.some((s) => isActive(path, s.href));
  const items = [...PRIMARY, { href: '/more', label: 'More', icon: Menu }];
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === '/more' ? moreActive : isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav() {
  const path = usePathname();
  const link = ({ href, label, icon: Icon }: (typeof PRIMARY)[number]) => (
    <li key={href}>
      <Link
        href={href}
        aria-current={isActive(path, href) ? 'page' : undefined}
        className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm ${isActive(path, href) ? 'bg-accent font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
      >
        <Icon size={18} aria-hidden="true" />
        {label}
      </Link>
    </li>
  );
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="space-y-0.5">{PRIMARY.map(link)}</ul>
      <p className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tools</p>
      <ul className="space-y-0.5">{SECONDARY.map(link)}</ul>
    </nav>
  );
}
