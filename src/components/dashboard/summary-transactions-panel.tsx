'use client';

import { useEffect, useState, useCallback } from 'react';
import { format as dateFnsFormat } from 'date-fns';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency, formatIsoDateForDisplay } from '@/lib/date-utils';
import type { TransactionWithTags, TimePeriod } from '@/types';

export type SummaryCardType =
  | 'total-spending'
  | 'tracked-spending'
  | 'untracked-spending'
  | 'total-income';

interface SummaryTransactionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardType: SummaryCardType | null;
  period: TimePeriod | null;
}

/**
 * Build date params that match the exact same UTC day boundaries the budget/summary
 * API uses: start = midnight UTC of the first day, end = 23:59:59.999 UTC of the last day.
 *
 * `period.start/end` are local-timezone Dates from date-fns (e.g. startOfMonth in
 * Toronto = 2026-04-01T04:00:00Z), so we cannot use toISOString() directly — it would
 * shift the window by the UTC offset and exclude/include different transactions than
 * the budget summary card values.
 */
function buildParams(cardType: SummaryCardType, period: TimePeriod): URLSearchParams {
  // Format as date-only string then construct UTC-aligned ISO timestamps so both
  // this fetch and /api/budget/summary target the identical transaction rows.
  const startStr = dateFnsFormat(period.start, 'yyyy-MM-dd');
  const endStr = dateFnsFormat(period.end, 'yyyy-MM-dd');
  const params = new URLSearchParams({
    start: `${startStr}T00:00:00.000Z`,
    end: `${endStr}T23:59:59.999Z`,
    nolimit: 'true',
  });
  switch (cardType) {
    case 'total-spending':
      params.set('type', 'debit');
      break;
    case 'tracked-spending':
      params.set('budgeted', 'true');
      break;
    case 'untracked-spending':
      params.set('unbudgeted', 'true');
      break;
    case 'total-income':
      params.set('type', 'credit');
      break;
  }
  return params;
}

function cardTitle(cardType: SummaryCardType): string {
  switch (cardType) {
    case 'total-spending':
      return 'Total Spending';
    case 'tracked-spending':
      return 'Tracked Spending';
    case 'untracked-spending':
      return 'Untracked Spending';
    case 'total-income':
      return 'Total Income';
  }
}

export function SummaryTransactionsPanel({
  open,
  onOpenChange,
  cardType,
  period,
}: SummaryTransactionsPanelProps) {
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(
    async (signal: AbortSignal) => {
      if (!cardType || !period) return;
      setLoading(true);
      setTransactions([]);
      setTotal(0);
      try {
        const params = buildParams(cardType, period);
        const res = await fetch(`/api/transactions?${params}`, { signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { data?: TransactionWithTags[]; total?: number };
        setTransactions(data.data ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setTransactions([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [cardType, period],
  );

  useEffect(() => {
    if (!open || !cardType || !period) return;
    const ac = new AbortController();
    const id = setTimeout(() => {
      void fetchTransactions(ac.signal);
    }, 0);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [open, cardType, period, fetchTransactions]);

  const isIncome = cardType === 'total-income';
  const totalDebit = transactions.reduce((s, tx) => s + (tx.debit ?? 0), 0);
  const totalCredit = transactions.reduce((s, tx) => s + (tx.credit ?? 0), 0);

  const title = cardType ? cardTitle(cardType) : '';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {period?.label} · {loading ? '…' : `${total} transaction${total !== 1 ? 's' : ''}`}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center py-12 text-sm">
              No transactions found for this period.
            </div>
          ) : (
            <ul className="divide-y">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {/* Date */}
                  <span className="text-muted-foreground w-20 shrink-0 tabular-nums">
                    {formatIsoDateForDisplay(tx.date, 'MMM d')}
                  </span>

                  {/* Name + tags */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate leading-tight font-medium">{tx.name}</p>
                    {tx.tags.filter((t) => !t.isSource).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tx.tags
                          .filter((t) => !t.isSource)
                          .map((t) => (
                            <TagBadge
                              key={t.id}
                              name={t.name}
                              color={t.color}
                              className="text-xs"
                            />
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right tabular-nums">
                    {tx.debit > 0 && (
                      <span className="text-foreground block">{formatCurrency(tx.debit)}</span>
                    )}
                    {tx.credit > 0 && (
                      <span className="block text-green-600 dark:text-green-400">
                        +{formatCurrency(tx.credit)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer totals */}
        {!loading && transactions.length > 0 && (
          <div className="border-t px-4 py-3">
            {!isIncome && totalDebit > 0 && (
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">Total spent</span>
                <span>{formatCurrency(totalDebit)}</span>
              </div>
            )}
            {totalCredit > 0 && (
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-muted-foreground">Total received</span>
                <span className="text-green-600 dark:text-green-400">
                  +{formatCurrency(totalCredit)}
                </span>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
