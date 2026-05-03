'use client';

import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { ROW_GRID } from './constants';
import { SortableLineRow } from './sortable-line-row';
import type { BudgetSummaryLine } from '@/types';

interface SelectedTag {
  id: string;
  name: string;
  color: string;
}

interface UncategorizedSectionProps {
  lines: BudgetSummaryLine[];
  onEditLine: (line: BudgetSummaryLine) => void;
  onDeleteLine: (id: string) => void;
  onTagClick?: (tag: SelectedTag) => void;
}

export function UncategorizedSection({
  lines,
  onEditLine,
  onDeleteLine,
  onTagClick,
}: UncategorizedSectionProps) {
  const subtotalBudget = lines.reduce((s, l) => s + l.scaledBudget, 0);
  const subtotalRollover = lines.reduce((s, l) => s + l.rolloverAmount, 0);
  const subtotalActual = lines.reduce((s, l) => s + l.actualSpending, 0);
  const subtotalRemaining = lines.reduce((s, l) => s + l.remaining, 0);

  return (
    <div className="border-b last:border-b-0">
      {/* Uncategorized header */}
      <div className={cn(ROW_GRID, 'bg-muted/30 px-3 py-2 font-semibold')}>
        <div /> {/* no drag handle */}
        <div className="text-muted-foreground col-span-3 text-sm">Uncategorized</div>
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
        <div /> {/* no actions */}
      </div>
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
    </div>
  );
}
