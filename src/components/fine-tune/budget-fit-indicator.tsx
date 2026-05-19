'use client';

import { cn } from '@/lib/utils';
import type { FitStatus } from './constants';
import { FIT_LABELS, FIT_DESCRIPTIONS } from './constants';

interface BudgetFitIndicatorProps {
  status: FitStatus;
  /** Optional compact mode — show only the dot + short label */
  compact?: boolean;
}

const STATUS_COLORS: Record<FitStatus, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
  insufficient: 'bg-gray-400',
};

const STATUS_RING_COLORS: Record<FitStatus, string> = {
  green: 'ring-green-300',
  yellow: 'ring-yellow-300',
  red: 'ring-red-300',
  insufficient: 'ring-gray-300',
};

const STATUS_TEXT_COLORS: Record<FitStatus, string> = {
  green: 'text-green-700',
  yellow: 'text-yellow-700',
  red: 'text-red-700',
  insufficient: 'text-gray-500',
};

export function BudgetFitIndicator({ status, compact = false }: BudgetFitIndicatorProps) {
  if (compact) {
    return (
      <span className="flex items-center gap-1.5" title={FIT_DESCRIPTIONS[status]}>
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full ring-2',
            STATUS_COLORS[status],
            STATUS_RING_COLORS[status],
          )}
        />
        <span className={cn('text-xs font-medium', STATUS_TEXT_COLORS[status])}>
          {FIT_LABELS[status]}
        </span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={cn(
          'h-8 w-8 rounded-full ring-4',
          STATUS_COLORS[status],
          STATUS_RING_COLORS[status],
        )}
        title={FIT_DESCRIPTIONS[status]}
      />
      <div className="text-center">
        <p className={cn('text-sm font-semibold', STATUS_TEXT_COLORS[status])}>
          {FIT_LABELS[status]}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">{FIT_DESCRIPTIONS[status]}</p>
      </div>
    </div>
  );
}
