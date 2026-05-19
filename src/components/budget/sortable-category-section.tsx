'use client';

import { GripVertical, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROW_GRID } from './constants';
import { SortableLineRow } from './sortable-line-row';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

interface SelectedTag {
  id: string;
  name: string;
  color: string;
}

interface SortableCategorySectionProps {
  category: BudgetCategory;
  lines: BudgetSummaryLine[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onEditCategory: (cat: BudgetCategory) => void;
  onDeleteCategory: (id: string) => void;
  onEditLine: (line: BudgetSummaryLine) => void;
  onDeleteLine: (id: string) => void;
  onTagClick?: (tag: SelectedTag) => void;
}

export function SortableCategorySection({
  category,
  lines,
  isCollapsed = false,
  onToggleCollapse,
  onEditCategory,
  onDeleteCategory,
  onEditLine,
  onDeleteLine,
  onTagClick,
}: SortableCategorySectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const subtotalBudget = lines.reduce((s, l) => s + l.scaledBudget, 0);
  const subtotalRollover = lines.reduce((s, l) => s + l.rolloverAmount, 0);
  const subtotalActual = lines.reduce((s, l) => s + l.actualSpending, 0);
  const subtotalRemaining = lines.reduce((s, l) => s + l.remaining, 0);

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
      {/* Category header row — entire row is clickable to toggle collapse */}
      <div
        className={cn(
          ROW_GRID,
          'bg-muted/50 hover:bg-muted/60 cursor-pointer px-3 py-2 font-semibold select-none',
        )}
        onClick={onToggleCollapse}
        aria-label={isCollapsed ? 'Expand category' : 'Collapse category'}
      >
        {/* Drag handle — stops row click from firing */}
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label="Drag to reorder category"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Category name spans name + tags + period columns */}
        <div className="col-span-3 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground shrink-0">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
          <span>{category.name}</span>
          {lines.length === 0 && (
            <span className="text-muted-foreground text-xs font-normal">(empty)</span>
          )}
        </div>

        {/* Subtotals */}
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalBudget)}</div>
        {/* Fit — empty for category rows */}
        <div />
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

        {/* Category actions — stop propagation so they don't trigger row click */}
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEditCategory(category);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteCategory(category.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Lines within this category — hidden when collapsed */}
      {!isCollapsed && (
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
              onTagClick={onTagClick}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}
