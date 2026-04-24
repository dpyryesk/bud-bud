'use client';

import { useEffect, useState, useCallback } from 'react';
import { Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button } from '@/components/ui/button';
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
import type { TransactionWithTags } from '@/types';

type TagOption = { id: string; name: string; color: string; isSource: boolean };

export default function TransactionsPage() {
  const { period } = useTimePeriod();
  const [transactions, setTransactions] = useState<TransactionWithTags[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [autoTagResult, setAutoTagResult] = useState<{
    total: number;
    tagged: number;
    skipped: number;
  } | null>(null);

  const fetchTransactions = useCallback(async () => {
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      page: page.toString(),
      limit: '50',
    });
    const res = await fetch(`/api/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.data);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  }, [period, page]);

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

  useEffect(() => {
    setPage(1);
  }, [period]);

  const handleSetTags = async (transactionId: string, tagIds: string[]) => {
    await fetch(`/api/transactions/${transactionId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds }),
    });
    fetchTransactions();
  };

  const handleUpdateNotes = async (transactionId: string, notes: string) => {
    await fetch(`/api/transactions/${transactionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    });
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground text-sm">{total} transactions for {period.label}</p>
        </div>
        <Button onClick={handleAutoTag} variant="outline">
          <Wand2 className="mr-2 h-4 w-4" />
          Auto-Tag
        </Button>
      </div>

      {autoTagResult && (
        <div className="bg-muted rounded-md p-3 text-sm">
          Auto-tag results: <strong>{autoTagResult.tagged}</strong> tagged,{' '}
          <strong>{autoTagResult.skipped}</strong> skipped out of{' '}
          <strong>{autoTagResult.total}</strong> untagged.
          <button onClick={() => setAutoTagResult(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px] text-right">Debit</TableHead>
              <TableHead className="w-[100px] text-right">Credit</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-[60px]">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground text-center">
                  No transactions for this period. Import some CSV files to get started.
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
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
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  transaction,
  availableTags,
  onSetTags,
  onUpdateNotes,
}: {
  transaction: TransactionWithTags;
  availableTags: TagOption[];
  onSetTags: (id: string, tagIds: string[]) => void;
  onUpdateNotes: (id: string, notes: string) => void;
}) {
  const nonSourceTags = transaction.tags.filter((t) => !t.isSource);
  const sourceTags = transaction.tags.filter((t) => t.isSource);
  const [localNotes, setLocalNotes] = useState(transaction.notes);

  const toggleTag = (tagId: string) => {
    const currentIds = nonSourceTags.map((t) => t.id);
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];
    onSetTags(transaction.id, newIds);
  };

  return (
    <TableRow>
      <TableCell className="text-xs">{format(new Date(transaction.date), 'MMM d, yyyy')}</TableCell>
      <TableCell>
        <div className="text-sm font-medium">{transaction.name}</div>
        {transaction.source && (
          <div className="text-muted-foreground text-xs">{transaction.source}</div>
        )}
        {sourceTags.length > 0 && (
          <div className="mt-1 flex gap-1">
            {sourceTags.map((t) => (
              <TagBadge key={t.id} name={t.name} color={t.color} isSource className="text-xs" />
            ))}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right text-sm">
        {transaction.debit > 0 ? formatCurrency(transaction.debit) : ''}
      </TableCell>
      <TableCell className="text-right text-sm text-green-600">
        {transaction.credit > 0 ? formatCurrency(transaction.credit) : ''}
      </TableCell>
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
          <Popover>
            <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-6 px-2 text-xs" />}>
              +
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {availableTags.map((tag) => {
                  const isSelected = nonSourceTags.some((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted ${
                        isSelected ? 'bg-muted' : ''
                      }`}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.name}
                      {isSelected && <span className="ml-auto">✓</span>}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
      <TableCell>
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-xs" />}>
            {localNotes ? '📝' : '➕'}
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <Textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => onUpdateNotes(transaction.id, localNotes)}
              placeholder="Add notes..."
              className="text-sm"
              rows={3}
            />
          </PopoverContent>
        </Popover>
      </TableCell>
    </TableRow>
  );
}
