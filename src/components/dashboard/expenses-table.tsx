'use client';

import { Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Expenses</CardTitle>
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
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="pr-4 pb-2 text-right font-medium">Amount</th>
                  <th className="pr-4 pb-2 font-medium">Period</th>
                  <th className="pr-4 pb-2 text-right font-medium">Yearly Total</th>
                  <th className="pr-4 pb-2 text-right font-medium">% of Budget</th>
                  <th className="pb-2 text-right font-medium">% of Income</th>
                </tr>
              </thead>
              <tbody>
                {orderedCategories.map((cat) => {
                  const lines = groupedLines[cat.id] ?? [];
                  if (lines.length === 0) return null;
                  return (
                    <Fragment key={cat.id}>
                      {/* Category header row */}
                      <tr className="bg-muted/40">
                        <td colSpan={6} className="px-3 py-1.5 text-sm font-semibold">
                          {cat.name}
                        </td>
                      </tr>
                      {lines.map((line) => (
                        <LineRow
                          key={line.budgetLine.id}
                          line={line}
                          totalYearlyBudget={totalYearlyBudget}
                          totalYearlyNetIncome={totalYearlyNetIncome}
                        />
                      ))}
                      <CategorySubtotals
                        lines={lines}
                        totalYearlyBudget={totalYearlyBudget}
                        totalYearlyNetIncome={totalYearlyNetIncome}
                      />
                    </Fragment>
                  );
                })}

                {uncategorizedLines.length > 0 && (
                  <>
                    <tr className="bg-muted/40">
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-3 py-1.5 text-sm font-semibold"
                      >
                        Uncategorized
                      </td>
                    </tr>
                    {uncategorizedLines.map((line) => (
                      <LineRow
                        key={line.budgetLine.id}
                        line={line}
                        totalYearlyBudget={totalYearlyBudget}
                        totalYearlyNetIncome={totalYearlyNetIncome}
                      />
                    ))}
                    <CategorySubtotals
                      lines={uncategorizedLines}
                      totalYearlyBudget={totalYearlyBudget}
                      totalYearlyNetIncome={totalYearlyNetIncome}
                    />
                  </>
                )}

                {/* Grand total */}
                <tr className="border-t font-bold">
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
