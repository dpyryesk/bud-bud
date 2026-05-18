'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTimePeriod } from '@/hooks/use-time-period';
import { TransactionsTable } from '@/components/transactions/transactions-table';

function TransactionsContent() {
  const { period } = useTimePeriod();
  const searchParams = useSearchParams();
  const initialUntaggedOnly = searchParams.get('untaggedOnly') === 'true';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Transactions</h1>
        <p className="text-muted-foreground text-sm">Viewing: {period.label}</p>
      </div>

      <TransactionsTable initialUntaggedOnly={initialUntaggedOnly} />
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}
