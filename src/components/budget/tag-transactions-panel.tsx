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
import { formatCurrency } from '@/lib/date-utils';
import type { TransactionWithTags } from '@/types';
import type { TimePeriod } from '@/types';

interface SelectedTag {
  id: string;
  name: string;
  color: string;
}

interface TagTransactionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: SelectedTag | null;
  period: TimePeriod;
}

export function TagTransactionsPanel({
  open,
  onOpenChange,
  tag,
  period,
}: TagTransactionsPanelProps) {
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchTransactions = useCallback(
    async (signal: AbortSignal) => {
      if (!tag) return;
      setLoading(true);
      setTransactions([]);
      setTotal(0);
      try {
        const params = new URLSearchParams({
          start: period.start.toISOString(),
          end: period.end.toISOString(),
          tagId: tag.id,
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
    [tag, period],
  );

  useEffect(() => {
    if (!open || !tag) return;
    const ac = new AbortController();
    const id = setTimeout(() => {
      void fetchTransactions(ac.signal);
    }, 0);
    return () => {
      clearTimeout(id);
      ac.abort();
    };
  }, [open, tag, fetchTransactions]);

  const totalDebit = transactions.reduce((s, tx) => s + (tx.debit ?? 0), 0);
  const totalCredit = transactions.reduce((s, tx) => s + (tx.credit ?? 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="border-b pb-3">
          <SheetTitle className="flex items-center gap-2">
            Transactions for{' '}
            {tag && <TagBadge name={tag.name} color={tag.color} className="text-sm" />}
          </SheetTitle>
          <SheetDescription>
            {period.label} · {loading ? '…' : `${total} transaction${total !== 1 ? 's' : ''}`}
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
              No transactions found for this tag and period.
            </div>
          ) : (
            <ul className="divide-y">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  {/* Date */}
                  <span className="text-muted-foreground w-20 shrink-0 tabular-nums">
                    {format(new Date(tx.date), 'MMM d')}
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
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground">Total spent</span>
              <span>{formatCurrency(totalDebit)}</span>
            </div>
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
