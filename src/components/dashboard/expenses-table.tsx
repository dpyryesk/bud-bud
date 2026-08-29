'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

interface ExpensesTableProps {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  totalYearlyNetIncome: number;
  /** Period-specific summary lines (scaledBudget / actualSpending / remaining for selected period). */
  periodSummaryLines?: BudgetSummaryLine[];
  /** Human-readable label for the selected period, e.g. "June 2026". */
  periodLabel?: string;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  biweekly: 'Bi-weekly',
  yearly: 'Yearly',
};

const UNCATEGORIZED_KEY = '__uncategorized__';

function lineIdentity(line: BudgetSummaryLine): string {
  return line.budgetLine.identityKey ?? line.budgetLine.id;
}

function pct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// LineRow
// ---------------------------------------------------------------------------

interface LineRowProps {
  line: BudgetSummaryLine;
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
  /** Matching entry from periodSummaryLines keyed by budgetLine.id, if available. */
  periodLine?: BudgetSummaryLine;
}

function LineRow({ line, totalYearlyBudget, totalYearlyNetIncome, periodLine }: LineRowProps) {
  const { budgetLine } = line;
  const yearlyAmount = getYearlyAmount(budgetLine.amount, budgetLine.period);

  return (
    <tr className="border-b text-sm last:border-0">
      <td className="py-1.5 pr-4 pl-6">{budgetLine.name}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(budgetLine.amount)}</td>
      <td className="py-1.5 pr-4">{PERIOD_LABEL[budgetLine.period] ?? budgetLine.period}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(yearlyAmount)}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">
        {pct(yearlyAmount, totalYearlyBudget)}
      </td>
      <td className={cn('py-1.5 text-right tabular-nums', periodLine !== undefined && 'pr-4')}>
        {pct(yearlyAmount, totalYearlyNetIncome)}
      </td>
      {periodLine !== undefined && (
        <>
          <td className="py-1.5 pr-4 text-right tabular-nums">
            {formatCurrency(periodLine.scaledBudget)}
          </td>
          <td className="py-1.5 pr-4 text-right tabular-nums">
            {formatCurrency(periodLine.actualSpending)}
          </td>
          <td
            className={cn(
              'py-1.5 text-right tabular-nums',
              periodLine.remaining < 0 ? 'text-destructive' : 'text-primary',
            )}
          >
            {formatCurrency(periodLine.remaining)}
          </td>
        </>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// CategorySubtotals (expanded view)
// ---------------------------------------------------------------------------

interface CategorySubtotalsProps {
  lines: BudgetSummaryLine[];
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
  periodLines?: BudgetSummaryLine[];
}

function CategorySubtotals({
  lines,
  totalYearlyBudget,
  totalYearlyNetIncome,
  periodLines,
}: CategorySubtotalsProps) {
  const yearlyTotal = lines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );
  const pBudget = periodLines?.reduce((s, l) => s + l.scaledBudget, 0);
  const pActual = periodLines?.reduce((s, l) => s + l.actualSpending, 0);
  const pRemaining = periodLines?.reduce((s, l) => s + l.remaining, 0);

  return (
    <tr className="bg-muted/20 text-sm font-medium">
      <td className="text-muted-foreground py-1.5 pr-4 pl-6 italic">Subtotal</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">
        {formatCurrency(lines.reduce((s, l) => s + l.scaledBudget, 0))}
      </td>
      <td className="py-1.5 pr-4" />
      <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(yearlyTotal)}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{pct(yearlyTotal, totalYearlyBudget)}</td>
      <td className={cn('py-1.5 text-right tabular-nums', periodLines !== undefined && 'pr-4')}>
        {pct(yearlyTotal, totalYearlyNetIncome)}
      </td>
      {periodLines !== undefined && (
        <>
          <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(pBudget ?? 0)}</td>
          <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(pActual ?? 0)}</td>
          <td
            className={cn(
              'py-1.5 text-right tabular-nums',
              (pRemaining ?? 0) < 0 ? 'text-destructive' : 'text-primary',
            )}
          >
            {formatCurrency(pRemaining ?? 0)}
          </td>
        </>
      )}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// InlineSubtotals (collapsed category header row)
// ---------------------------------------------------------------------------

function InlineSubtotals({
  lines,
  totalYearlyBudget,
  totalYearlyNetIncome,
  periodLines,
}: CategorySubtotalsProps) {
  const scaledTotal = lines.reduce((s, l) => s + l.scaledBudget, 0);
  const yearlyTotal = lines.reduce(
    (s, l) => s + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );
  const pBudget = periodLines?.reduce((s, l) => s + l.scaledBudget, 0);
  const pActual = periodLines?.reduce((s, l) => s + l.actualSpending, 0);
  const pRemaining = periodLines?.reduce((s, l) => s + l.remaining, 0);

  return (
    <>
      <td className="text-muted-foreground py-1.5 pr-2 text-right text-xs tabular-nums">
        {formatCurrency(scaledTotal)}
      </td>
      <td className="py-1.5 pr-4" />
      <td className="text-muted-foreground py-1.5 pr-4 text-right text-xs tabular-nums">
        {formatCurrency(yearlyTotal)}
      </td>
      <td className="text-muted-foreground py-1.5 pr-4 text-right text-xs tabular-nums">
        {pct(yearlyTotal, totalYearlyBudget)}
      </td>
      <td
        className={cn(
          'text-muted-foreground py-1.5 text-right text-xs tabular-nums',
          periodLines !== undefined && 'pr-4',
        )}
      >
        {pct(yearlyTotal, totalYearlyNetIncome)}
      </td>
      {periodLines !== undefined && (
        <>
          <td className="text-muted-foreground py-1.5 pr-4 text-right text-xs tabular-nums">
            {formatCurrency(pBudget ?? 0)}
          </td>
          <td className="text-muted-foreground py-1.5 pr-4 text-right text-xs tabular-nums">
            {formatCurrency(pActual ?? 0)}
          </td>
          <td
            className={cn(
              'py-1.5 text-right text-xs tabular-nums',
              (pRemaining ?? 0) < 0 ? 'text-destructive' : 'text-primary',
            )}
          >
            {formatCurrency(pRemaining ?? 0)}
          </td>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CollapseChevron helper
// ---------------------------------------------------------------------------

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  ) : (
    <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  );
}

// ---------------------------------------------------------------------------
// ExpensesTable
// ---------------------------------------------------------------------------

export function ExpensesTable({
  summaryLines,
  orderedCategories,
  totalYearlyNetIncome,
  periodSummaryLines,
  periodLabel,
}: ExpensesTableProps) {
  const hasPeriod = periodSummaryLines !== undefined && periodSummaryLines.length > 0;

  // Map budget line id → period summary line for O(1) lookups
  const periodLineMap = new Map<string, BudgetSummaryLine>();
  if (hasPeriod) {
    for (const pl of periodSummaryLines!) {
      periodLineMap.set(lineIdentity(pl), pl);
    }
  }

  const totalYearlyBudget = summaryLines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );

  // Group lines by category
  const groupedLines: Record<string, BudgetSummaryLine[]> = {};
  for (const cat of orderedCategories) {
    groupedLines[cat.id] = summaryLines.filter((l) => l.budgetLine.categoryId === cat.id);
  }
  const uncategorizedLines = summaryLines.filter((l) => l.budgetLine.categoryId === null);

  // ---- Collapse state ----
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const allKeys = [
    ...orderedCategories
      .filter((cat) => (groupedLines[cat.id] ?? []).length > 0)
      .map((cat) => cat.id),
    ...(uncategorizedLines.length > 0 ? [UNCATEGORIZED_KEY] : []),
  ];

  const collapseAll = () => setCollapsedIds(new Set(allKeys));
  const expandAll = () => setCollapsedIds(new Set());

  // Number of "trailing" cols after Name: 5 yearly cols + 3 period cols (optional)
  const trailingColSpan = hasPeriod ? 8 : 5;

  // Period totals across all lines
  const periodTotalBudget = hasPeriod
    ? (periodSummaryLines?.reduce((s, l) => s + l.scaledBudget, 0) ?? 0)
    : 0;
  const periodTotalActual = hasPeriod
    ? (periodSummaryLines?.reduce((s, l) => s + l.actualSpending, 0) ?? 0)
    : 0;
  const periodTotalRemaining = hasPeriod
    ? (periodSummaryLines?.reduce((s, l) => s + l.remaining, 0) ?? 0)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Budget Expenses</CardTitle>
          {allKeys.length > 0 && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
                Collapse All
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
                Expand All
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {summaryLines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No budget lines configured. Set up your budget to see expenses here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="text-muted-foreground pr-4 pb-2 text-xs font-semibold tracking-wide uppercase">
                    Name
                  </th>
                  <th className="text-muted-foreground pr-4 pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                    Amount
                  </th>
                  <th className="text-muted-foreground pr-4 pb-2 text-xs font-semibold tracking-wide uppercase">
                    Period
                  </th>
                  <th className="text-muted-foreground pr-4 pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                    Yearly Total
                  </th>
                  <th className="text-muted-foreground pr-4 pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                    % of Budget
                  </th>
                  <th
                    className={cn(
                      'text-muted-foreground pb-2 text-right text-xs font-semibold tracking-wide uppercase',
                      hasPeriod && 'pr-4',
                    )}
                  >
                    % of Income
                  </th>
                  {hasPeriod && (
                    <>
                      <th className="text-muted-foreground border-l pr-4 pb-2 pl-4 text-right text-xs font-semibold tracking-wide uppercase">
                        {periodLabel ?? 'Period'} Budget
                      </th>
                      <th className="text-muted-foreground pr-4 pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                        {periodLabel ?? 'Period'} Actual
                      </th>
                      <th className="text-muted-foreground pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                        {periodLabel ?? 'Period'} Remaining
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {orderedCategories.map((cat) => {
                  const lines = groupedLines[cat.id] ?? [];
                  if (lines.length === 0) return null;
                  const collapsed = collapsedIds.has(cat.id);

                  // Period lines for this category
                  const periodCatLines = hasPeriod
                    ? (lines
                        .map((l) => periodLineMap.get(lineIdentity(l)))
                        .filter(Boolean) as BudgetSummaryLine[])
                    : undefined;

                  return (
                    <Fragment key={cat.id}>
                      {/* Category header row */}
                      <tr
                        className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
                        onClick={() => toggleCollapse(cat.id)}
                        aria-label={collapsed ? 'Expand category' : 'Collapse category'}
                      >
                        <td className="border-primary/50 border-l-[3px] px-3 py-1.5 text-sm font-semibold">
                          <span className="flex items-center gap-1.5">
                            <CollapseChevron collapsed={collapsed} />
                            {cat.name}
                          </span>
                        </td>
                        {collapsed ? (
                          <InlineSubtotals
                            lines={lines}
                            totalYearlyBudget={totalYearlyBudget}
                            totalYearlyNetIncome={totalYearlyNetIncome}
                            periodLines={periodCatLines}
                          />
                        ) : (
                          <td colSpan={trailingColSpan} />
                        )}
                      </tr>

                      {/* Individual line rows */}
                      {!collapsed &&
                        lines.map((line) => (
                          <LineRow
                            key={line.budgetLine.id}
                            line={line}
                            totalYearlyBudget={totalYearlyBudget}
                            totalYearlyNetIncome={totalYearlyNetIncome}
                            periodLine={periodLineMap.get(lineIdentity(line))}
                          />
                        ))}

                      {/* Subtotals row */}
                      {!collapsed && (
                        <CategorySubtotals
                          lines={lines}
                          totalYearlyBudget={totalYearlyBudget}
                          totalYearlyNetIncome={totalYearlyNetIncome}
                          periodLines={periodCatLines}
                        />
                      )}
                    </Fragment>
                  );
                })}

                {/* Uncategorized section */}
                {uncategorizedLines.length > 0 &&
                  (() => {
                    const collapsed = collapsedIds.has(UNCATEGORIZED_KEY);
                    const periodUncatLines = hasPeriod
                      ? (uncategorizedLines
                          .map((l) => periodLineMap.get(lineIdentity(l)))
                          .filter(Boolean) as BudgetSummaryLine[])
                      : undefined;

                    return (
                      <Fragment key={UNCATEGORIZED_KEY}>
                        <tr
                          className="bg-muted/30 hover:bg-muted/50 cursor-pointer select-none"
                          onClick={() => toggleCollapse(UNCATEGORIZED_KEY)}
                          aria-label={collapsed ? 'Expand category' : 'Collapse category'}
                        >
                          <td className="border-muted-foreground/30 border-l-[3px] px-3 py-1.5 text-sm font-semibold">
                            <span className="flex items-center gap-1.5">
                              <CollapseChevron collapsed={collapsed} />
                              <span className="text-muted-foreground">Uncategorized</span>
                            </span>
                          </td>
                          {collapsed ? (
                            <InlineSubtotals
                              lines={uncategorizedLines}
                              totalYearlyBudget={totalYearlyBudget}
                              totalYearlyNetIncome={totalYearlyNetIncome}
                              periodLines={periodUncatLines}
                            />
                          ) : (
                            <td colSpan={trailingColSpan} />
                          )}
                        </tr>
                        {!collapsed &&
                          uncategorizedLines.map((line) => (
                            <LineRow
                              key={line.budgetLine.id}
                              line={line}
                              totalYearlyBudget={totalYearlyBudget}
                              totalYearlyNetIncome={totalYearlyNetIncome}
                              periodLine={periodLineMap.get(lineIdentity(line))}
                            />
                          ))}
                        {!collapsed && (
                          <CategorySubtotals
                            lines={uncategorizedLines}
                            totalYearlyBudget={totalYearlyBudget}
                            totalYearlyNetIncome={totalYearlyNetIncome}
                            periodLines={periodUncatLines}
                          />
                        )}
                      </Fragment>
                    );
                  })()}

                {/* Grand total */}
                <tr className="bg-muted/30 border-t-2 font-bold">
                  <td className="py-2 pr-4">Grand Total</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(summaryLines.reduce((s, l) => s + l.scaledBudget, 0))}
                  </td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(totalYearlyBudget)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">100%</td>
                  <td className={cn('py-2 text-right tabular-nums', hasPeriod && 'pr-4')}>
                    {pct(totalYearlyBudget, totalYearlyNetIncome)}
                  </td>
                  {hasPeriod && (
                    <>
                      <td className="border-l py-2 pr-4 pl-4 text-right tabular-nums">
                        {formatCurrency(periodTotalBudget)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(periodTotalActual)}
                      </td>
                      <td
                        className={cn(
                          'py-2 text-right tabular-nums',
                          periodTotalRemaining < 0 ? 'text-destructive' : 'text-primary',
                        )}
                      >
                        {formatCurrency(periodTotalRemaining)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
