'use client';

import { useState, useRef } from 'react';
import { Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import { buttonVariants } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { TransactionWithTags } from '@/types';
import type { TagOptionWithLevel } from './constants';
import { AutoTagRuleSheet } from './auto-tag-rule-sheet';

interface TransactionRowProps {
  transaction: TransactionWithTags;
  availableTags: TagOptionWithLevel[];
  onSetTags: (
    id: string,
    tagIds: string[],
    previousTags: TransactionWithTags['tags'],
  ) => Promise<TransactionWithTags['tags']>;
  onUpdateNotes: (id: string, notes: string) => void;
  onRuleCreated: () => void;
}

export function TransactionRow({
  transaction,
  availableTags,
  onSetTags,
  onUpdateNotes,
  onRuleCreated,
}: TransactionRowProps) {
  const [localTags, setLocalTags] = useState(transaction.tags);
  const [localNotes, setLocalNotes] = useState(transaction.notes ?? '');
  const [ruleSheetOpen, setRuleSheetOpen] = useState(false);
  const tagRequestSeqRef = useRef(0);

  const nonSourceTags = localTags.filter((t) => !t.isSource);
  const sourceTags = localTags.filter((t) => t.isSource);

  const toggleTag = async (tagId: string) => {
    const currentIds = nonSourceTags.map((t) => t.id);
    const newIds = currentIds.includes(tagId)
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];

    const previousTags = localTags;
    const optimisticNonSource = availableTags.filter((t) => newIds.includes(t.id));
    setLocalTags([...sourceTags, ...optimisticNonSource]);

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
        <div className="text-sm leading-tight font-medium">{transaction.name}</div>
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
        <div className="mt-2">
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'h-6 px-1.5 text-xs')}
            onClick={() => setRuleSheetOpen(true)}
          >
            <Wand2 className="mr-1 h-3 w-3" />
            Create auto-tag rule
          </button>
        </div>
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
          <span className="text-green-600 dark:text-green-400">
            {formatCurrency(transaction.credit)}
          </span>
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
              onRemoveAction={() => void toggleTag(t.id)}
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
                <p className="text-muted-foreground p-1 text-xs">
                  No tags available. Create some in Tags.
                </p>
              ) : (
                <div className="max-h-52 space-y-0.5 overflow-y-auto">
                  {availableTags.map((tag) => {
                    const isSelected = nonSourceTags.some((t) => t.id === tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={cn(
                          'hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors',
                          isSelected && 'bg-muted',
                        )}
                        onClick={() => void toggleTag(tag.id)}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate" style={{ marginLeft: `${tag.level * 14}px` }}>
                          {tag.name}
                        </span>
                        {isSelected && <span className="ml-auto text-xs opacity-70">✓</span>}
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
              className="min-h-18 resize-none text-sm"
              rows={3}
            />
          </PopoverContent>
        </Popover>
      </TableCell>

      <AutoTagRuleSheet
        open={ruleSheetOpen}
        onOpenChange={setRuleSheetOpen}
        transaction={transaction}
        availableTags={availableTags}
        onRuleCreated={onRuleCreated}
      />
    </TableRow>
  );
}
