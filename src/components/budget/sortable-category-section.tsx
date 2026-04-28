'use client';

import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROW_GRID } from './constants';
import { SortableLineRow } from './sortable-line-row';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

interface SortableCategorySectionProps {
  category: BudgetCategory;
  lines: BudgetSummaryLine[];
  onEditCategory: (cat: BudgetCategory) => void;
  onDeleteCategory: (id: string) => void;
  onEditLine: (line: BudgetSummaryLine) => void;
  onDeleteLine: (id: string) => void;
}

export function SortableCategorySection({
  category,
  lines,
  onEditCategory,
  onDeleteCategory,
  onEditLine,
  onDeleteLine,
}: SortableCategorySectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const subtotalBudget = lines.reduce((s, l) => s + l.effectiveBudget, 0);
  const subtotalRollover = lines.reduce((s, l) => s + l.rolloverAmount, 0);
  const subtotalActual = lines.reduce((s, l) => s + l.actualSpending, 0);
  const subtotalRemaining = subtotalBudget - subtotalActual;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn('border-b last:border-b-0', isDragging && 'bg-muted/30')}
    >
      {/* Category header row */}
      <div className={cn(ROW_GRID, 'bg-muted/50 px-3 py-2 font-semibold')}>
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label="Drag to reorder category"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Category name spans name + tags + period columns */}
        <div className="col-span-3 flex items-center gap-2 text-sm">
          <span>{category.name}</span>
          {lines.length === 0 && (
            <span className="text-muted-foreground text-xs font-normal">(empty)</span>
          )}
        </div>

        {/* Subtotals */}
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalBudget)}</div>
        <div className="text-muted-foreground text-right text-sm tabular-nums">
          {subtotalRollover !== 0 ? formatCurrency(subtotalRollover) : '—'}
        </div>
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalActual)}</div>
        <div
          className={cn(
            'text-right text-sm font-semibold tabular-nums',
            subtotalRemaining >= 0 ? 'text-green-600' : 'text-red-600',
          )}
        >
          {formatCurrency(subtotalRemaining)}
        </div>

        {/* Category actions */}
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditCategory(category)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-7 w-7"
            onClick={() => onDeleteCategory(category.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Lines within this category */}
      <SortableContext
        items={lines.map((l) => l.budgetLine.id)}
        strategy={verticalListSortingStrategy}
      >
        {lines.map((line) => (
          <SortableLineRow
            key={line.budgetLine.id}
            line={line}
            onEdit={onEditLine}
            onDelete={onDeleteLine}
          />
        ))}
      </SortableContext>
    </div>
  );
}
