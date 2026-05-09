'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

interface ExpensesTableProps {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  totalYearlyNetIncome: number;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  biweekly: 'Bi-weekly',
  yearly: 'Yearly',
};

const UNCATEGORIZED_KEY = '__uncategorized__';

function pct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

interface LineRowProps {
  line: BudgetSummaryLine;
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
}

function LineRow({ line, totalYearlyBudget, totalYearlyNetIncome }: LineRowProps) {
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
      <td className="py-1.5 text-right tabular-nums">{pct(yearlyAmount, totalYearlyNetIncome)}</td>
    </tr>
  );
}

interface CategorySubtotalsProps {
  lines: BudgetSummaryLine[];
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
}

function CategorySubtotals({
  lines,
  totalYearlyBudget,
  totalYearlyNetIncome,
}: CategorySubtotalsProps) {
  const yearlyTotal = lines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );
  return (
    <tr className="bg-muted/20 text-sm font-medium">
      <td className="text-muted-foreground py-1.5 pr-4 pl-6 italic">Subtotal</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">
        {formatCurrency(lines.reduce((s, l) => s + l.scaledBudget, 0))}
      </td>
      <td className="py-1.5 pr-4" />
      <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(yearlyTotal)}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{pct(yearlyTotal, totalYearlyBudget)}</td>
      <td className="py-1.5 text-right tabular-nums">{pct(yearlyTotal, totalYearlyNetIncome)}</td>
    </tr>
  );
}

function CollapseChevron({ collapsed }: { collapsed: boolean }) {
  return collapsed ? (
    <ChevronRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  ) : (
    <ChevronDown className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
  );
}

/** Inline subtotal cells shown in the header row when a category is collapsed (5 cells). */
function InlineSubtotals({
  lines,
  totalYearlyBudget,
  totalYearlyNetIncome,
}: CategorySubtotalsProps) {
  const scaledTotal = lines.reduce((s, l) => s + l.scaledBudget, 0);
  const yearlyTotal = lines.reduce(
    (s, l) => s + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );
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
      <td className="text-muted-foreground py-1.5 text-right text-xs tabular-nums">
        {pct(yearlyTotal, totalYearlyNetIncome)}
      </td>
    </>
  );
}

export function ExpensesTable({
  summaryLines,
  orderedCategories,
  totalYearlyNetIncome,
}: ExpensesTableProps) {
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
                  <th className="text-muted-foreground pb-2 text-right text-xs font-semibold tracking-wide uppercase">
                    % of Income
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedCategories.map((cat) => {
                  const lines = groupedLines[cat.id] ?? [];
                  if (lines.length === 0) return null;
                  const collapsed = collapsedIds.has(cat.id);
                  return (
                    <Fragment key={cat.id}>
                      {/* Category header row — name cell is always 1 col; remaining 5 cols show
                          inline subtotals when collapsed or a transparent spacer when expanded */}
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
                          />
                        ) : (
                          <td colSpan={5} />
                        )}
                      </tr>

                      {/* Individual line rows — hidden when collapsed */}
                      {!collapsed &&
                        lines.map((line) => (
                          <LineRow
                            key={line.budgetLine.id}
                            line={line}
                            totalYearlyBudget={totalYearlyBudget}
                            totalYearlyNetIncome={totalYearlyNetIncome}
                          />
                        ))}

                      {/* Subtotals row — shown only when expanded */}
                      {!collapsed && (
                        <CategorySubtotals
                          lines={lines}
                          totalYearlyBudget={totalYearlyBudget}
                          totalYearlyNetIncome={totalYearlyNetIncome}
                        />
                      )}
                    </Fragment>
                  );
                })}

                {/* Uncategorized section */}
                {uncategorizedLines.length > 0 &&
                  (() => {
                    const collapsed = collapsedIds.has(UNCATEGORIZED_KEY);
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
                            />
                          ) : (
                            <td colSpan={5} />
                          )}
                        </tr>
                        {!collapsed &&
                          uncategorizedLines.map((line) => (
                            <LineRow
                              key={line.budgetLine.id}
                              line={line}
                              totalYearlyBudget={totalYearlyBudget}
                              totalYearlyNetIncome={totalYearlyNetIncome}
                            />
                          ))}
                        {!collapsed && (
                          <CategorySubtotals
                            lines={uncategorizedLines}
                            totalYearlyBudget={totalYearlyBudget}
                            totalYearlyNetIncome={totalYearlyNetIncome}
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
                  <td className="py-2 text-right tabular-nums">
                    {pct(totalYearlyBudget, totalYearlyNetIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
