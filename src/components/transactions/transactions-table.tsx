'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Wand2, ChevronLeft, ChevronRight, Search, FilterX, Loader2 } from 'lucide-react';
import { useTimePeriod } from '@/hooks/use-time-period';
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
import { buildTagsInDisplayOrder } from '@/lib/tag-tree';
import type { TransactionWithTags } from '@/types';
import { TransactionRow } from './transaction-row';
import type { TagOption, TagOptionWithLevel } from './constants';

interface TransactionsTableProps {
  /** Extra query params forwarded to /api/transactions (e.g. { unbudgeted: 'true' }) */
  extraParams?: Record<string, string>;
}

export function TransactionsTable({ extraParams }: TransactionsTableProps) {
  const { period } = useTimePeriod();

  // Stable string key representing the current "scope" (period + extra params).
  // When this changes, pagination resets to page 1.
  const scopeKey = useMemo(
    () =>
      JSON.stringify({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        ...extraParams,
      }),
    [period, extraParams],
  );

  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  // pageState bundles page + the scope it belongs to so we can reset atomically
  // from useMemo/render path rather than inside a useEffect.
  const [pageState, setPageState] = useState({ page: 1, scopeKey });
  const [totalPages, setTotalPages] = useState(1);
  const [tags, setTags] = useState<TagOptionWithLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<{
    total: number;
    tagged: number;
    skipped: number;
  } | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive the effective page: reset to 1 whenever the scope changes.
  // This is a pure derivation from state — no effect needed.
  const effectivePage = pageState.scopeKey === scopeKey ? pageState.page : 1;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageState({ page: 1, scopeKey });
    }, 300);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        page: effectivePage.toString(),
        limit: '50',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (untaggedOnly) params.set('untaggedOnly', 'true');
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          params.set(k, v);
        }
      }
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [period, effectivePage, debouncedSearch, untaggedOnly, extraParams]);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    const categoryTags = data.filter((t: TagOption) => !t.isSource);
    setTags(buildTagsInDisplayOrder(categoryTags));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void fetchTransactions(), 0);
    return () => clearTimeout(id);
  }, [fetchTransactions]);

  useEffect(() => {
    const id = setTimeout(() => void fetchTags(), 0);
    return () => clearTimeout(id);
  }, [fetchTags]);

  const handleTagsUpdated = useCallback(
    (transactionId: string, updatedTags: TransactionWithTags['tags']) => {
      setTransactions((prev) =>
        prev.map((tx) => (tx.id === transactionId ? { ...tx, tags: updatedTags } : tx)),
      );
    },
    [],
  );

  const handleSetTags = useCallback(
    async (
      transactionId: string,
      tagIds: string[],
      previousTags: TransactionWithTags['tags'],
    ): Promise<TransactionWithTags['tags']> => {
      const res = await fetch(`/api/transactions/${transactionId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds }),
      });
      if (!res.ok) {
        handleTagsUpdated(transactionId, previousTags);
        return previousTags;
      }
      const data = await res.json();
      const updatedTags: TransactionWithTags['tags'] = data.tags ?? previousTags;
      handleTagsUpdated(transactionId, updatedTags);
      return updatedTags;
    },
    [handleTagsUpdated],
  );

  const handleUpdateNotes = useCallback(async (transactionId: string, notes: string) => {
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
    if (!res.ok) return;
    setTransactions((prev) => prev.map((tx) => (tx.id === transactionId ? { ...tx, notes } : tx)));
  }, []);

  const handleAutoTag = async () => {
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const res = await fetch(`/api/auto-tag?${params}`, { method: 'POST' });
    const data = await res.json();
    setAutoTagResult(data);
    void fetchTransactions();
  };

  const toggleUntaggedOnly = () => {
    setUntaggedOnly((v) => !v);
    setPageState({ page: 1, scopeKey });
  };

  const emptyMessage =
    debouncedSearch || untaggedOnly
      ? 'No transactions match the current filters.'
      : 'No transactions for this period.';

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search transactions…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={untaggedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={toggleUntaggedOnly}
          title={untaggedOnly ? 'Showing untagged only — click to clear' : 'Show untagged only'}
        >
          <FilterX className="mr-1.5 h-3.5 w-3.5" />
          Untagged only
        </Button>
        <Button onClick={() => void handleAutoTag()} variant="outline" size="sm">
          <Wand2 className="mr-1.5 h-3.5 w-3.5" />
          Auto-Tag
        </Button>
        <span className="text-muted-foreground ml-auto text-sm">
          {loading ? 'Loading…' : `${total} transaction${total !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Auto-tag result banner */}
      {autoTagResult && (
        <div className="bg-muted rounded-md p-3 text-sm">
          Auto-tag complete: <strong>{autoTagResult.tagged}</strong> tagged,{' '}
          <strong>{autoTagResult.skipped}</strong> skipped out of{' '}
          <strong>{autoTagResult.total}</strong> untagged.
          <button onClick={() => setAutoTagResult(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-27.5">Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-26.25 text-right">Debit</TableHead>
              <TableHead className="w-26.25 text-right">Credit</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-14 text-center">Notes</TableHead>
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
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TransactionRow
                  key={`${tx.id}-${tx.tags.map((t) => t.id).join(',')}-${tx.notes ?? ''}`}
                  transaction={tx}
                  availableTags={tags}
                  onSetTags={handleSetTags}
                  onUpdateNotes={handleUpdateNotes}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPageState((prev) => ({ page: Math.max(1, prev.page - 1), scopeKey }))}
            disabled={effectivePage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {effectivePage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setPageState((prev) => ({ page: Math.min(totalPages, prev.page + 1), scopeKey }))
            }
            disabled={effectivePage === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
