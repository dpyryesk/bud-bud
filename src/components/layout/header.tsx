'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { TimePeriodSelector } from './time-period-selector';

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-50 border-b">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Wallet className="h-5 w-5" />
          <span className="hidden sm:inline">Budget Buddy</span>
        </Link>
        <TimePeriodSelector />
      </div>
    </header>
  );
}
