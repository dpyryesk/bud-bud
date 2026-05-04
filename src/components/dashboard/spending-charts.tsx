'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/date-utils';
import type { BudgetSummaryLine, BudgetCategory, UntrackedCategoryWithSpending } from '@/types';

interface SpendingChartsProps {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  untrackedCategories: UntrackedCategoryWithSpending[];
  totalTrulyUncategorized: number;
}

// ---- Chart A: Budget Category Spending ----

interface BudgetCategoryChartProps {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
}

type CategoryDatum = {
  name: string;
  budget: number;
  actual: number;
};

function BudgetCategoryChart({ summaryLines, orderedCategories }: BudgetCategoryChartProps) {
  const [logScale, setLogScale] = useState(false);

  // Build per-category data
  const catMap = new Map<string, { name: string; budget: number; actual: number }>();
  for (const cat of orderedCategories) {
    catMap.set(cat.id, { name: cat.name, budget: 0, actual: 0 });
  }

  for (const line of summaryLines) {
    const catId = line.budgetLine.categoryId ?? '__uncat__';
    const existing = catMap.get(catId);
    if (existing) {
      existing.budget += line.scaledBudget;
      existing.actual += line.actualSpending;
    } else {
      catMap.set(catId, {
        name: catId === '__uncat__' ? 'Uncategorized' : 'Other',
        budget: line.scaledBudget,
        actual: line.actualSpending,
      });
    }
  }

  const data: CategoryDatum[] = Array.from(catMap.values())
    .filter((d) => d.budget > 0 || d.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  if (data.length === 0) return null;

  const chartHeight = Math.max(200, data.length * 40);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Budget vs. Actual by Category</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setLogScale((v) => !v)}>
          {logScale ? 'Linear scale' : 'Log scale'}
        </Button>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 20, right: 20, top: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              scale={logScale ? 'log' : 'auto'}
              domain={logScale ? ['auto', 'auto'] : [0, 'auto']}
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: unknown) => formatCurrency(value as number)} />
            <Legend />
            <Bar dataKey="budget" name="Budget" fill="#9ca3af" radius={[0, 3, 3, 0]} />
            <Bar dataKey="actual" name="Actual" radius={[0, 3, 3, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.actual > entry.budget ? '#ef4444' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---- Chart B: Untracked Spending ----

interface UntrackedChartProps {
  untrackedCategories: UntrackedCategoryWithSpending[];
  totalTrulyUncategorized: number;
}

type UntrackedDatum = {
  name: string;
  amount: number;
  isUncategorized: boolean;
};

function UntrackedChart({ untrackedCategories, totalTrulyUncategorized }: UntrackedChartProps) {
  const data: UntrackedDatum[] = [
    ...untrackedCategories
      .filter((c) => c.actualSpending > 0)
      .map((c) => ({ name: c.name, amount: c.actualSpending, isUncategorized: false })),
  ];

  if (totalTrulyUncategorized > 0) {
    data.push({ name: 'Uncategorized', amount: totalTrulyUncategorized, isUncategorized: true });
  }

  if (data.length === 0) return null;

  const chartHeight = Math.max(160, data.length * 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Untracked Spending</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 20, right: 20, top: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatCurrency(v)}
              tick={{ fontSize: 11 }}
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: unknown) => formatCurrency(value as number)} />
            <Bar dataKey="amount" name="Spending" radius={[0, 3, 3, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.isUncategorized ? '#f59e0b' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ---- Main export ----

export function SpendingCharts({
  summaryLines,
  orderedCategories,
  untrackedCategories,
  totalTrulyUncategorized,
}: SpendingChartsProps) {
  return (
    <div className="space-y-4">
      <BudgetCategoryChart summaryLines={summaryLines} orderedCategories={orderedCategories} />
      <UntrackedChart
        untrackedCategories={untrackedCategories}
        totalTrulyUncategorized={totalTrulyUncategorized}
      />
    </div>
  );
}
