'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button } from '@/components/ui/button';
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
import { TransactionsFilterBar } from './transactions-filter-bar';

interface TransactionsTableProps {
  /** Extra query params forwarded to /api/transactions (e.g. { unbudgeted: 'true' }) */
  extraParams?: Record<string, string>;
  /** Pre-activate the "Untagged only" filter on first render (e.g. when navigated from the sidebar checklist) */
  initialUntaggedOnly?: boolean;
}

export function TransactionsTable({
  extraParams,
  initialUntaggedOnly = false,
}: TransactionsTableProps) {
  const { period } = useTimePeriod();

  // ---- Filter state ----
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [untaggedOnly, setUntaggedOnly] = useState(initialUntaggedOnly);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [prevInitialUntaggedOnly, setPrevInitialUntaggedOnly] = useState(initialUntaggedOnly);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [debouncedMinAmount, setDebouncedMinAmount] = useState('');
  const [debouncedMaxAmount, setDebouncedMaxAmount] = useState('');

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minAmountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxAmountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Data state ----
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [tags, setTags] = useState<TagOptionWithLevel[]>([]);
  const [sourceTags, setSourceTags] = useState<TagOptionWithLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<{
    total: number;
    tagged: number;
    skipped: number;
  } | null>(null);
  const [ruleCreatedNotice, setRuleCreatedNotice] = useState<string | null>(null);

  // ---- Scope key & pagination ----
  // Stable string key representing the current "scope" (period + extra params + filters).
  // When this changes, pagination resets to page 1.
  const scopeKey = useMemo(
    () =>
      JSON.stringify({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        debouncedSearch,
        untaggedOnly,
        filterTagIds,
        debouncedMinAmount,
        debouncedMaxAmount,
        ...extraParams,
      }),
    [
      period,
      debouncedSearch,
      untaggedOnly,
      filterTagIds,
      debouncedMinAmount,
      debouncedMaxAmount,
      extraParams,
    ],
  );

  // pageState bundles page + the scope it belongs to so we can reset atomically
  const [pageState, setPageState] = useState({ page: 1, scopeKey });

  // Keep URL-driven initial filter in sync when this page stays mounted
  // and only search params change (e.g. navigating to /transactions?untaggedOnly=true).
  // Use the derived-state-during-render pattern to avoid setState-in-effect lint errors.
  if (prevInitialUntaggedOnly !== initialUntaggedOnly) {
    setPrevInitialUntaggedOnly(initialUntaggedOnly);
    setUntaggedOnly(initialUntaggedOnly);
    if (initialUntaggedOnly) {
      setFilterTagIds([]);
    }
    setPageState((prev) => ({ ...prev, page: 1 }));
  }

  // Derive the effective page: reset to 1 whenever the scope changes.
  const effectivePage = pageState.scopeKey === scopeKey ? pageState.page : 1;

  // ---- Debounced handlers ----
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageState({ page: 1, scopeKey });
    }, 300);
  };

  const handleMinAmountChange = (value: string) => {
    setMinAmount(value);
    if (minAmountDebounceRef.current) clearTimeout(minAmountDebounceRef.current);
    minAmountDebounceRef.current = setTimeout(() => {
      setDebouncedMinAmount(value);
      setPageState({ page: 1, scopeKey });
    }, 500);
  };

  const handleMaxAmountChange = (value: string) => {
    setMaxAmount(value);
    if (maxAmountDebounceRef.current) clearTimeout(maxAmountDebounceRef.current);
    maxAmountDebounceRef.current = setTimeout(() => {
      setDebouncedMaxAmount(value);
      setPageState({ page: 1, scopeKey });
    }, 500);
  };

  // ---- Tag filter handler (mutex with untaggedOnly) ----
  const handleFilterTagToggle = (tagId: string) => {
    setFilterTagIds((prev) => {
      const next = prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId];
      // Selecting any tag clears the "untagged only" mode
      if (next.length > 0) setUntaggedOnly(false);
      return next;
    });
    setPageState({ page: 1, scopeKey });
  };

  // ---- Untagged-only toggle (mutex with tag filter) ----
  const handleUntaggedOnlyToggle = () => {
    setUntaggedOnly((v) => {
      const next = !v;
      if (next) setFilterTagIds([]);
      return next;
    });
    setPageState({ page: 1, scopeKey });
  };

  // ---- Clear advanced filters ----
  const handleClearAdvancedFilters = () => {
    setFilterTagIds([]);
    setMinAmount('');
    setMaxAmount('');
    setDebouncedMinAmount('');
    setDebouncedMaxAmount('');
    setPageState({ page: 1, scopeKey });
  };

  // ---- Fetch transactions ----
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        // Use date-only strings so the server always receives UTC midnight boundaries,
        // matching how transaction dates are stored (UTC midnight).
        start: format(period.start, 'yyyy-MM-dd'),
        end: format(period.end, 'yyyy-MM-dd'),
        page: effectivePage.toString(),
        limit: '50',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (untaggedOnly) params.set('untaggedOnly', 'true');
      // Tag filter: only apply if no tag filter comes from extraParams
      if (filterTagIds.length > 0 && !extraParams?.tagId && !extraParams?.tagIds) {
        params.set('tagIds', filterTagIds.join(','));
      }
      if (debouncedMinAmount) params.set('minAmount', debouncedMinAmount);
      if (debouncedMaxAmount) params.set('maxAmount', debouncedMaxAmount);
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) {
          params.set(k, v);
        }
      }
      const res = await fetch(`/api/transactions?${params}`);
      if (!res.ok) {
        setTransactions([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }
      const data = await res.json();
      setTransactions(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setTransactions([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    period,
    effectivePage,
    debouncedSearch,
    untaggedOnly,
    filterTagIds,
    debouncedMinAmount,
    debouncedMaxAmount,
    extraParams,
  ]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) return;
      const data = await res.json();
      const categoryTags = data.filter((t: TagOption) => !t.isSource);
      const srcTags = data.filter((t: TagOption) => t.isSource);
      setTags(buildTagsInDisplayOrder(categoryTags));
      setSourceTags(buildTagsInDisplayOrder(srcTags));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void fetchTransactions(), 0);
    return () => clearTimeout(id);
  }, [fetchTransactions]);

  useEffect(() => {
    const id = setTimeout(() => void fetchTags(), 0);
    return () => clearTimeout(id);
  }, [fetchTags]);

  // ---- Tag update handlers ----
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

  const handleRemoveTag = useCallback(
    async (
      transactionId: string,
      tagId: string,
      previousTags: TransactionWithTags['tags'],
    ): Promise<TransactionWithTags['tags']> => {
      const res = await fetch(`/api/transactions/${transactionId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
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

  const handleArchive = useCallback(async (transactionId: string) => {
    const res = await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    });
    if (!res.ok) return;
    setTransactions((prev) => prev.filter((tx) => tx.id !== transactionId));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const handleAutoTag = async () => {
    try {
      const params = new URLSearchParams({
        start: format(period.start, 'yyyy-MM-dd'),
        end: format(period.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/auto-tag?${params}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAutoTagResult(data);
        void fetchTransactions();
      }
    } catch {
      // non-critical
    }
  };

  const handleRuleCreated = useCallback(
    (applied: boolean) => {
      if (applied) {
        void fetchTransactions();
        setRuleCreatedNotice('Auto-tag rule created and applied. Tags updated.');
      } else {
        setRuleCreatedNotice('Auto-tag regex rule created. Use "Auto-Tag" to apply rules now.');
      }
    },
    [fetchTransactions],
  );

  // Hide advanced filters when the parent already filters by tag via extraParams
  const hideAdvancedFilters = !!(extraParams?.tagId ?? extraParams?.tagIds);

  const emptyMessage =
    debouncedSearch ||
    untaggedOnly ||
    filterTagIds.length > 0 ||
    debouncedMinAmount ||
    debouncedMaxAmount
      ? 'No transactions match the current filters.'
      : 'No transactions for this period.';

  return (
    <div className="space-y-3">
      {/* Toolbar / filter bar */}
      <TransactionsFilterBar
        availableTags={tags}
        availableSourceTags={sourceTags}
        search={search}
        untaggedOnly={untaggedOnly}
        filterTagIds={filterTagIds}
        minAmount={minAmount}
        maxAmount={maxAmount}
        onSearchChange={handleSearchChange}
        onUntaggedOnlyToggle={handleUntaggedOnlyToggle}
        onFilterTagToggle={handleFilterTagToggle}
        onMinAmountChange={handleMinAmountChange}
        onMaxAmountChange={handleMaxAmountChange}
        onClearAdvancedFilters={handleClearAdvancedFilters}
        onAutoTag={() => void handleAutoTag()}
        total={total}
        loading={loading}
        hideAdvancedFilters={hideAdvancedFilters}
      />

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

      {ruleCreatedNotice && (
        <div className="bg-muted rounded-md p-3 text-sm">
          {ruleCreatedNotice}
          <button onClick={() => setRuleCreatedNotice(null)} className="ml-2 underline">
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
              <TableHead className="w-14 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
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
                  onRemoveTag={handleRemoveTag}
                  onUpdateNotes={handleUpdateNotes}
                  onRuleCreated={handleRuleCreated}
                  onArchive={handleArchive}
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
