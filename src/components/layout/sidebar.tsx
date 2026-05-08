'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ArrowLeftRight, Tags, Upload, PiggyBank, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/tags', label: 'Tags', icon: Tags },
  { href: '/budget', label: 'Budget', icon: PiggyBank },
  { href: '/budgets', label: 'Manage Budgets', icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="bg-sidebar border-sidebar-border hidden w-56 border-r md:block">
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <div key={item.href} className="relative">
              {isActive && (
                <span className="bg-sidebar-primary absolute inset-y-1.5 left-0 w-0.75 rounded-r-full" />
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background fixed right-0 bottom-0 left-0 z-50 border-t md:hidden">
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] leading-tight',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="w-full truncate text-center">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
