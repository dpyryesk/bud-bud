'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
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
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import type { TransactionWithTags, TimePeriod } from '@/types';

interface UntrackedTransactionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → show truly uncategorized (pre-fetched) */
  categoryName: string | null;
  /** If tagIds is null, use preloadedTransactions instead */
  tagIds: string[] | null;
  /** Pre-fetched truly uncategorized transactions (used when tagIds is null) */
  preloadedTransactions?: TransactionWithTags[];
  period: TimePeriod;
}

export function UntrackedTransactionsPanel({
  open,
  onOpenChange,
  categoryName,
  tagIds,
  preloadedTransactions,
  period,
}: UntrackedTransactionsPanelProps) {
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(
    async (signal: AbortSignal) => {
      if (!tagIds || tagIds.length === 0) return;
      setLoading(true);
      setTransactions([]);
      setTotal(0);
      try {
        const params = new URLSearchParams({
          // Use date-only strings so the server receives UTC midnight boundaries,
          // matching how transaction dates are stored (UTC midnight).
          start: format(period.start, 'yyyy-MM-dd'),
          end: format(period.end, 'yyyy-MM-dd'),
          tagIds: tagIds.join(','),
          limit: '200',
        });
        const res = await fetch(`/api/transactions?${params}`, { signal });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { data?: TransactionWithTags[]; total?: number };
        setTransactions(data.data ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        if ((err as { name?: string }).name === 'AbortError') return;
        setTransactions([]);
        setTotal(0);
      }
    },
    [tagIds, period],
  );

  useEffect(() => {
    if (!open) return;

    // If no tagIds, use pre-loaded transactions
    if (!tagIds) {
      const txs = preloadedTransactions ?? [];
      const id = setTimeout(() => {
        setTransactions(txs);
        setTotal(txs.length);
        setLoading(false);
      }, 0);
      return () => clearTimeout(id);
    }

    const ac = new AbortController();
    const id = setTimeout(() => {
      void fetchTransactions(ac.signal);
    }, 0);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [open, tagIds, fetchTransactions, preloadedTransactions]);

  const totalDebit = transactions.reduce((s, tx) => s + (tx.debit ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b pb-3">
          <SheetTitle>{categoryName ?? 'Uncategorized'}</SheetTitle>
          <SheetDescription>
            {period.label} · {loading ? '…' : `${total} transaction${total !== 1 ? 's' : ''}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {loading ? (
            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-muted-foreground flex flex-1 items-center justify-center py-12 text-sm">
              No transactions found.
            </div>
          ) : (
            <TooltipProvider>
              <ul className="divide-y">
                {transactions.map((tx) => (
                  <li key={tx.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                    <span className="text-muted-foreground w-20 shrink-0 tabular-nums">
                      {formatIsoDateForDisplay(tx.date, 'MMM d')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger
                          render={<p className="truncate leading-tight font-medium" />}
                        >
                          {tx.name}
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start">
                          {tx.name}
                        </TooltipContent>
                      </Tooltip>
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
            </TooltipProvider>
          )}
        </div>

        {!loading && transactions.length > 0 && (
          <div className="border-t px-4 py-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground">Total spent</span>
              <span>{formatCurrency(totalDebit)}</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
