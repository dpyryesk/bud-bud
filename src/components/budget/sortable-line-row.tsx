'use client';

import Link from 'next/link';
import { GripVertical, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, buttonVariants } from '@/components/ui/button';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROW_GRID } from './constants';
import type { BudgetSummaryLine } from '@/types';
import type { FitStatus } from '@/types';

interface SelectedTag {
  id: string;
  name: string;
  color: string;
}

interface SortableLineRowProps {
  line: BudgetSummaryLine;
  onEdit: (line: BudgetSummaryLine) => void;
  onDelete: (id: string) => void;
  onTagClick?: (tag: SelectedTag) => void;
}

const FIT_DOT_COLORS: Record<FitStatus, string> = {
  green: 'bg-green-500 ring-green-300',
  yellow: 'bg-yellow-400 ring-yellow-300',
  red: 'bg-red-500 ring-red-300',
  insufficient: 'bg-gray-400 ring-gray-300',
};

const FIT_TOOLTIPS: Record<FitStatus, string> = {
  green: 'Good fit — budget closely matches historical spending',
  yellow: 'Moderate fit — budget moderately matches historical spending',
  red: 'Poor fit — budget significantly differs from historical spending',
  insufficient: 'Insufficient data — need at least 3 months of history to assess fit',
};

export function SortableLineRow({ line, onEdit, onDelete, onTagClick }: SortableLineRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.budgetLine.id,
  });

  const fitStatus: FitStatus = line.fitStatus ?? 'insufficient';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        ROW_GRID,
        'hover:bg-muted/20 border-b px-3 py-2 text-sm last:border-b-0',
        isDragging && 'bg-muted/30',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Name */}
      <div className="min-w-0">
        <span className="font-medium">{line.budgetLine.name}</span>
        {line.budgetLine.rollover && (
          <span className="text-muted-foreground ml-1 text-xs" title="Rollover enabled">
            🔄
          </span>
        )}
      </div>

      {/* Tags */}
      <div className="flex min-w-0 flex-wrap gap-1">
        {line.budgetLine.tags.map((t) =>
          onTagClick ? (
            <button
              key={t.id}
              type="button"
              onClick={() => onTagClick(t)}
              className="cursor-pointer rounded focus-visible:ring-2 focus-visible:outline-none"
              title={`View transactions tagged "${t.name}"`}
            >
              <TagBadge name={t.name} color={t.color} className="text-xs hover:opacity-80" />
            </button>
          ) : (
            <TagBadge key={t.id} name={t.name} color={t.color} className="text-xs" />
          ),
        )}
      </div>

      {/* Period */}
      <div className="text-muted-foreground capitalize">{line.budgetLine.period}</div>

      {/* Budget */}
      <div className="text-right tabular-nums">{formatCurrency(line.scaledBudget)}</div>

      {/* Fit — traffic light dot + fine-tune button */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2',
            FIT_DOT_COLORS[fitStatus],
          )}
          title={FIT_TOOLTIPS[fitStatus]}
        />
        <Link
          href={`/budget/fine-tune?lineId=${line.budgetLine.id}`}
          title="Fine Tune"
          className={buttonVariants({
            variant: 'ghost',
            size: 'icon',
            className: 'text-muted-foreground h-7 w-7',
          })}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Rollover */}
      <div className="text-muted-foreground text-right tabular-nums">
        {line.rolloverAmount !== 0 ? formatCurrency(line.rolloverAmount) : '—'}
      </div>

      {/* Actual */}
      <div className="text-right tabular-nums">{formatCurrency(line.actualSpending)}</div>

      {/* Remaining */}
      <div
        className={cn(
          'text-right font-medium tabular-nums',
          line.remaining >= 0 ? 'text-green-600' : 'text-red-600',
        )}
      >
        {formatCurrency(line.remaining)}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(line)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive h-7 w-7"
          onClick={() => onDelete(line.budgetLine.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
