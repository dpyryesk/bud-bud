'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/date-utils';
import { BudgetFitIndicator } from './budget-fit-indicator';
import {
  getFitStatus,
  getVariabilityLevel,
  VARIABILITY_LABELS,
  calcProjectedYearly,
} from './constants';
import type { FineTuneStats, FineTuneMonthlyDataPoint } from '@/types';
import type { BudgetPeriodType } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { formatMonthKeyLong } from './constants';

interface StatsCardsProps {
  stats: FineTuneStats;
  monthlyData: FineTuneMonthlyDataPoint[];
  draftAmount: number;
  draftPeriod: BudgetPeriodType;
  totalYearlyIncome: number;
  totalYearlyBudget: number;
}

function StatCard({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-muted-foreground truncate text-xs">{label}</p>
        <p className={cn('mt-0.5 truncate text-lg font-semibold tabular-nums', valueClass)}>
          {value}
        </p>
        {sub && <p className="text-muted-foreground mt-0.5 text-xs">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function StatsCards({
  stats,
  monthlyData,
  draftAmount,
  draftPeriod,
  totalYearlyIncome,
  totalYearlyBudget,
}: StatsCardsProps) {
  const {
    average,
    stdDev,
    min,
    max,
    cv,
    monthCount,
    nonZeroMonthCount,
    totalSpending,
    highestMonth,
    lowestNonZeroMonth,
  } = stats;

  // Compute the spending amount for lowestNonZeroMonth from monthlyData so we
  // display the correct non-zero value (stats.min includes zero months).
  const lowestNonZeroAmount = lowestNonZeroMonth
    ? (monthlyData.find((m) => m.month === lowestNonZeroMonth)?.spending ?? null)
    : null;

  const projectedYearly = calcProjectedYearly(draftAmount, draftPeriod);
  const expectedYearly = average * 12;
  const fitStatus = getFitStatus(projectedYearly, expectedYearly, monthCount);
  const varLevel = getVariabilityLevel(cv, monthCount);

  const incomePercent = totalYearlyIncome > 0 ? (projectedYearly / totalYearlyIncome) * 100 : null;
  const budgetPercent =
    totalYearlyBudget + projectedYearly > 0
      ? (projectedYearly / (totalYearlyBudget + projectedYearly)) * 100
      : null;

  const varLabelColor: Record<string, string> = {
    low: 'text-green-600',
    moderate: 'text-yellow-600',
    high: 'text-red-600',
    na: 'text-muted-foreground',
  };

  const formatMonth = (monthKey: string | null) => {
    if (!monthKey) return '—';
    return formatMonthKeyLong(monthKey) || monthKey;
  };

  return (
    <div className="space-y-3">
      {/* Budget fit indicator */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            <BudgetFitIndicator status={fitStatus} />
            <div className="text-sm">
              <p className="font-medium">Budget fit</p>
              <p className="text-muted-foreground mt-0.5">
                Projected{' '}
                <span className="font-medium text-green-600">
                  {formatCurrency(projectedYearly)}/yr
                </span>{' '}
                vs expected{' '}
                <span className="font-medium text-blue-600">
                  {expectedYearly > 0 ? formatCurrency(expectedYearly) : '—'}/yr
                </span>
                {expectedYearly > 0 &&
                  ` (${projectedYearly > expectedYearly ? '+' : ''}${(((projectedYearly - expectedYearly) / expectedYearly) * 100).toFixed(1)}%)`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Row 1: Historical stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Avg/month (historical)"
          value={formatCurrency(average)}
          sub={`${monthCount} months of data`}
        />
        <StatCard
          label="Std deviation"
          value={formatCurrency(stdDev)}
          sub={monthCount >= 2 ? `±${formatCurrency(stdDev)}/mo range` : 'Need ≥2 months'}
        />
        <StatCard
          label="Variability"
          value={VARIABILITY_LABELS[varLevel]}
          sub={monthCount >= 2 ? `CV = ${(cv * 100).toFixed(0)}%` : undefined}
          valueClass={varLabelColor[varLevel]}
        />
        <StatCard
          label="Total in history"
          value={formatCurrency(totalSpending)}
          sub={`${nonZeroMonthCount}/${monthCount} months with spend`}
        />
      </div>

      {/* Row 2: Min/max */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Monthly minimum"
          value={formatCurrency(min)}
          sub={min === 0 ? 'Includes zero months' : undefined}
        />
        <StatCard
          label="Monthly maximum"
          value={formatCurrency(max)}
          sub={highestMonth ? `In ${formatMonth(highestMonth)}` : undefined}
        />
        <StatCard
          label="Lowest spending month"
          value={lowestNonZeroMonth ? formatMonth(lowestNonZeroMonth) : '—'}
          sub={
            lowestNonZeroMonth && lowestNonZeroAmount !== null
              ? formatCurrency(lowestNonZeroAmount)
              : 'No spend recorded'
          }
        />
        <StatCard
          label="Highest spending month"
          value={highestMonth ? formatMonth(highestMonth) : '—'}
          sub={highestMonth ? formatCurrency(max) : 'No spend recorded'}
        />
      </div>

      {/* Row 3: Projection & fit */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Projected yearly budget"
          value={formatCurrency(projectedYearly)}
          sub={`${draftAmount.toFixed(2)}/${draftPeriod}`}
        />
        <StatCard
          label="Expected yearly (history)"
          value={expectedYearly > 0 ? formatCurrency(expectedYearly) : '—'}
          sub={average > 0 ? `${formatCurrency(average)}/mo avg` : 'No data'}
        />
        <StatCard
          label="% of yearly income"
          value={incomePercent !== null ? `${incomePercent.toFixed(1)}%` : '—'}
          sub={
            incomePercent !== null
              ? `of ${formatCurrency(totalYearlyIncome)}/yr income`
              : 'No income sources'
          }
          valueClass={incomePercent !== null && incomePercent > 25 ? 'text-yellow-600' : undefined}
        />
        <StatCard
          label="% of total yearly budget"
          value={budgetPercent !== null ? `${budgetPercent.toFixed(1)}%` : '—'}
          sub={`of ${formatCurrency(totalYearlyBudget + projectedYearly)}/yr total`}
        />
      </div>
    </div>
  );
}
