'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency, formatIsoDateForDisplay } from '@/lib/date-utils';
import type { TransactionWithTags } from '@/types';

export function ArchivedTransactionsTable() {
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams({ archived: 'true', page: String(page), limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    const timer = setTimeout(
      () =>
        fetch(`/api/transactions?${params}`, { signal: controller.signal })
          .then((res) => res.json())
          .then((data: { data?: TransactionWithTags[]; total?: number; totalPages?: number }) => {
            setTransactions(data.data ?? []);
            setTotal(data.total ?? 0);
            setTotalPages(data.totalPages ?? 1);
            setLoading(false);
          })
          .catch((err: unknown) => {
            if (err instanceof Error && err.name !== 'AbortError') setLoading(false);
          }),
      200,
    );

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [page, search]);

  const handleRestore = useCallback(async (id: string) => {
    const res = await fetch(`/api/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });
    if (!res.ok) return;
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search archived…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setLoading(true);
          }}
          className="max-w-xs"
        />
        <span className="text-muted-foreground text-sm">
          {loading ? '' : `${total} transaction${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-27.5">Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-26.25 text-right">Debit</TableHead>
              <TableHead className="w-26.25 text-right">Credit</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-20 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  {search.trim()
                    ? 'No transactions match the search.'
                    : 'No archived transactions.'}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => {
                const nonSourceTags = tx.tags.filter((t) => !t.isSource);
                return (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs tabular-nums">
                      {formatIsoDateForDisplay(tx.date, 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm leading-tight font-medium">{tx.name}</div>
                      {tx.source && (
                        <div className="text-muted-foreground text-xs">{tx.source}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {tx.debit > 0 ? formatCurrency(tx.debit) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {tx.credit > 0 ? (
                        <span className="text-green-600 dark:text-green-400">
                          {formatCurrency(tx.credit)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {nonSourceTags.map((t) => (
                          <TagBadge key={t.id} name={t.name} color={t.color} className="text-xs" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => void handleRestore(tx.id)}
                        title="Restore transaction"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
