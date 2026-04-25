'use client';

import Image from 'next/image';
import Link from 'next/link';
import icon1 from '../../app/icon1.png';
import { TimePeriodSelector } from './time-period-selector';

export function Header() {
  return (
    <header className="bg-background sticky top-0 z-50 border-b">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src={icon1} alt="Budget Buddy logo" className="h-10 w-10" />
          <span className="hidden font-mono text-3xl font-bold sm:inline">Budget Buddy</span>
        </Link>
        <TimePeriodSelector />
      </div>
    </header>
  );
}
