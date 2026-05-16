'use client';

import { useState, useRef } from 'react';
import { Archive, Wand2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TableCell, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TagBadge } from '@/components/tags/tag-badge';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import { formatCurrency, formatIsoDateForDisplay } from '@/lib/date-utils';
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
  onRemoveTag: (
    id: string,
    tagId: string,
    previousTags: TransactionWithTags['tags'],
  ) => Promise<TransactionWithTags['tags']>;
  onUpdateNotes: (id: string, notes: string) => void;
  onRuleCreated: (applied: boolean) => void;
  onArchive?: (id: string) => void;
}

export function TransactionRow({
  transaction,
  availableTags,
  onSetTags,
  onRemoveTag,
  onUpdateNotes,
  onRuleCreated,
  onArchive,
}: TransactionRowProps) {
  const [localTags, setLocalTags] = useState(transaction.tags);
  const [localNotes, setLocalNotes] = useState(transaction.notes ?? '');
  const [ruleSheetOpen, setRuleSheetOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
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

  const removeSourceTag = async (tagId: string) => {
    const previousTags = localTags;
    setLocalTags(localTags.filter((t) => t.id !== tagId));

    tagRequestSeqRef.current += 1;
    const seq = tagRequestSeqRef.current;

    const confirmed = await onRemoveTag(transaction.id, tagId, previousTags);
    if (seq === tagRequestSeqRef.current) {
      setLocalTags(confirmed);
    }
  };

  return (
    <>
      <TableRow>
        {/* Date */}
        <TableCell className="text-xs tabular-nums">
          {formatIsoDateForDisplay(transaction.date, 'MMM d, yyyy')}
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
                <TagBadge
                  key={t.id}
                  name={t.name}
                  color={t.color}
                  isSource
                  onRemoveAction={() => void removeSourceTag(t.id)}
                  className="text-xs"
                />
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
            <TagSelectorDropdown
              mode="multi"
              tags={availableTags}
              value={nonSourceTags.map((t) => t.id)}
              onToggle={(tagId) => void toggleTag(tagId)}
              triggerClassName={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'h-5 px-1.5')}
              triggerLabel="+"
              triggerAriaLabel="Add tag"
              align="start"
            />
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

        {/* Actions */}
        {onArchive && (
          <TableCell className="text-center">
            <button
              type="button"
              className={cn(
                buttonVariants({ variant: 'ghost', size: 'icon-xs' }),
                'text-muted-foreground hover:text-destructive',
              )}
              aria-label="Archive transaction"
              title="Archive transaction"
              onClick={() => setArchiveDialogOpen(true)}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          </TableCell>
        )}
      </TableRow>

      {/* Archive confirm dialog */}
      {onArchive && (
        <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Archive Transaction</DialogTitle>
              <DialogDescription>
                Archive &ldquo;{transaction.name}&rdquo;? Archived transactions are excluded from
                all calculations and can be restored later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  setArchiveDialogOpen(false);
                  onArchive(transaction.id);
                }}
              >
                Archive
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AutoTagRuleSheet
        open={ruleSheetOpen}
        onOpenChange={setRuleSheetOpen}
        transaction={transaction}
        availableTags={availableTags}
        onRuleCreated={onRuleCreated}
      />
    </>
  );
}
