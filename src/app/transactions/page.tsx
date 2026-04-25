'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Wand2, ChevronLeft, ChevronRight, Search, FilterX, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { TransactionWithTags } from '@/types';

type TagOption = { id: string; name: string; color: string; isSource: boolean };

export default function TransactionsPage() {
  const { period } = useTimePeriod();
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [autoTagResult, setAutoTagResult] = useState<{
    total: number;
    tagged: number;
    skipped: number;
  } | null>(null);

  // Debounced search value to avoid excessive API calls
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  };

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        page: page.toString(),
        limit: '50',
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (untaggedOnly) params.set('untaggedOnly', 'true');

      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [period, page, debouncedSearch, untaggedOnly]);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data.filter((t: TagOption) => !t.isSource));
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Reset to page 1 when period, search, or filter changes
  useEffect(() => {
    setPage(1);
  }, [period, untaggedOnly]);

  // Update a single transaction's tags in-place (optimistic)
  const handleTagsUpdated = useCallback((transactionId: string, updatedTags: TransactionWithTags['tags']) => {
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === transactionId ? { ...tx, tags: updatedTags } : tx)),
    );
  }, []);

  const handleSetTags = useCallback(
    async (transactionId: string, tagIds: string[], previousTags: TransactionWithTags['tags']): Promise<TransactionWithTags['tags']> => {
      const res = await fetch(`/api/transactions/${transactionId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds }),
      });
      if (!res.ok) {
        // Rollback to previous tags on failure
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
    // Update notes in-place without full refetch
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === transactionId ? { ...tx, notes } : tx)),
    );
  }, []);

  const handleAutoTag = async () => {
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const res = await fetch(`/api/auto-tag?${params}`, { method: 'POST' });
    const data = await res.json();
    setAutoTagResult(data);
    fetchTransactions();
  };

  const toggleUntaggedOnly = () => {
    setUntaggedOnly((v) => !v);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">
            {loading ? 'Loading…' : `${total} transaction${total !== 1 ? 's' : ''} for ${period.label}`}
          </p>
        </div>
        <Button onClick={handleAutoTag} variant="outline">
          <Wand2 className="mr-2 h-4 w-4" />
          Auto-Tag
        </Button>
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

      {/* Search + filter toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
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
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[105px] text-right">Debit</TableHead>
              <TableHead className="w-[105px] text-right">Credit</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[56px] text-center">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center py-8">
                  {debouncedSearch || untaggedOnly
                    ? 'No transactions match the current filters.'
                    : 'No transactions for this period. Import some CSV files to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx) => (
                <TransactionRow
                  key={tx.id}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- Transaction Row ----

function TransactionRow({
  transaction,
  availableTags,
  onSetTags,
  onUpdateNotes,
}: {
  transaction: TransactionWithTags;
  availableTags: TagOption[];
  onSetTags: (id: string, tagIds: string[], previousTags: TransactionWithTags['tags']) => Promise<TransactionWithTags['tags']>;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  // Local tag state for optimistic updates — keeps the popover open
  const [localTags, setLocalTags] = useState(transaction.tags);
  // Local notes state for editing
  const [localNotes, setLocalNotes] = useState(transaction.notes ?? '');
  // Sequence counter to ignore stale responses from concurrent requests
  const tagRequestSeqRef = useRef(0);

  // Sync when transaction is refreshed (e.g. after auto-tag)
  useEffect(() => {
    setLocalTags(transaction.tags);
  }, [transaction.tags]);

  useEffect(() => {
    setLocalNotes(transaction.notes ?? '');
  }, [transaction.notes]);

  const nonSourceTags = localTags.filter((t) => !t.isSource);
  const sourceTags = localTags.filter((t) => t.isSource);

  const toggleTag = async (tagId: string) => {
    const currentIds = nonSourceTags.map((t) => t.id);
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];

    // Capture previous tags for potential rollback
    const previousTags = localTags;

    // Optimistic update — build expected tag list from availableTags
    const optimisticNonSource = availableTags.filter((t) => newIds.includes(t.id));
    setLocalTags([...sourceTags, ...optimisticNonSource]);

    // Track this request's sequence number; ignore result if a newer request has fired
    tagRequestSeqRef.current += 1;
    const seq = tagRequestSeqRef.current;

    const confirmed = await onSetTags(transaction.id, newIds, previousTags);
    if (seq === tagRequestSeqRef.current) {
      setLocalTags(confirmed);
    }
  };

  return (
    <TableRow>
      {/* Date */}
      <TableCell className="text-xs tabular-nums">
        {format(new Date(transaction.date), 'MMM d, yyyy')}
      </TableCell>

      {/* Name + source */}
      <TableCell>
        <div className="text-sm font-medium leading-tight">{transaction.name}</div>
        {transaction.source && (
          <div className="text-muted-foreground text-xs">{transaction.source}</div>
        )}
        {sourceTags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {sourceTags.map((t) => (
              <TagBadge key={t.id} name={t.name} color={t.color} isSource className="text-xs" />
            ))}
          </div>
        )}
      </TableCell>

      {/* Debit */}
      <TableCell className="text-right text-sm tabular-nums">
        {transaction.debit > 0 ? (
          <span className="text-foreground">{formatCurrency(transaction.debit)}</span>
        ) : null}
      </TableCell>

      {/* Credit */}
      <TableCell className="text-right text-sm tabular-nums">
        {transaction.credit > 0 ? (
          <span className="text-green-600 dark:text-green-400">{formatCurrency(transaction.credit)}</span>
        ) : null}
      </TableCell>

      {/* Tags */}
      <TableCell>
        <div className="flex flex-wrap items-center gap-1">
          {nonSourceTags.map((t) => (
            <TagBadge
              key={t.id}
              name={t.name}
              color={t.color}
              onRemove={() => toggleTag(t.id)}
              className="text-xs"
            />
          ))}

          {/* Add tag popover */}
          <Popover>
            <PopoverTrigger
              className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'h-5 px-1.5')}
              aria-label="Add tag"
            >
              +
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start">
              {availableTags.length === 0 ? (
                <p className="text-muted-foreground p-1 text-xs">No tags available. Create some in Tags.</p>
              ) : (
                <div className="max-h-52 space-y-0.5 overflow-y-auto">
                  {availableTags.map((tag) => {
                    const isSelected = nonSourceTags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                          isSelected && 'bg-muted',
                        )}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                        {isSelected && (
                          <span className="ml-auto text-xs opacity-70">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>

      {/* Notes */}
      <TableCell className="text-center">
        <Popover>
          <PopoverTrigger
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
              localNotes ? 'text-amber-500' : 'text-muted-foreground',
            )}
            aria-label={localNotes ? 'Edit notes' : 'Add notes'}
            title={localNotes || undefined}
          >
            {localNotes ? '📝' : '＋'}
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <p className="text-muted-foreground mb-1.5 text-xs font-medium">Notes</p>
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => onUpdateNotes(transaction.id, localNotes)}
              placeholder="Add notes…"
              className="min-h-[72px] resize-none text-sm"
              rows={3}
            />
          </PopoverContent>
        </Popover>
      </TableCell>
    </TableRow>
  );
}
