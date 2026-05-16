'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

export type MonthlyTrendPoint = {
  month: string;
  income: number;
  spending: number;
};

type Props = {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  monthlyTrend: MonthlyTrendPoint[];
  viewYear: number;
};

const CATEGORY_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#06b6d4',
  '#84cc16',
  '#fb923c',
  '#a855f7',
  '#14b8a6',
];

/** Returns the day number within the year (1 = Jan 1, 365/366 = Dec 31). */
function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/** Returns 366 for leap years, 365 otherwise. */
function getDaysInYear(year: number): number {
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtCurrencyShort(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${Math.round(value / 1000)}k`;
  }
  return `$${Math.round(value)}`;
}

export function SpendingCharts({ summaryLines, orderedCategories, monthlyTrend, viewYear }: Props) {
  const today = new Date();
  const isCurrentYear = viewYear === today.getFullYear();
  const yearFraction = isCurrentYear ? getDayOfYear(today) / getDaysInYear(viewYear) : 1.0;

  const categoryData = useMemo(() => {
    return orderedCategories
      .map((cat) => {
        const lines = summaryLines.filter((l) => l.budgetLine.category?.id === cat.id);
        return {
          category: cat.name,
          budget: Math.round(lines.reduce((s, l) => s + l.scaledBudget, 0) * yearFraction),
          actual: Math.round(lines.reduce((s, l) => s + l.actualSpending, 0)),
        };
      })
      .filter((d) => d.budget > 0 || d.actual > 0);
  }, [summaryLines, orderedCategories, yearFraction]);

  const hasAnyData =
    categoryData.length > 0 || monthlyTrend.some((p) => p.income > 0 || p.spending > 0);

  if (!hasAnyData) return null;

  // Height for bar chart: 60px per category + margins
  const barChartHeight = Math.max(280, categoryData.length * 60 + 60);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Year at a Glance</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="bar">
          <TabsList>
            <TabsTrigger value="bar">Budget vs Actual</TabsTrigger>
            <TabsTrigger value="donut">Spending Breakdown</TabsTrigger>
            <TabsTrigger value="trend">Monthly Trend</TabsTrigger>
          </TabsList>

          {/* ── Chart 1: Budget vs Actual horizontal bar chart ── */}
          <TabsContent value="bar" className="mt-4">
            {categoryData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No budget category data for this year.
              </p>
            ) : (
              <>
                {isCurrentYear && (
                  <p className="text-muted-foreground mb-2 text-right text-xs">
                    Budget scaled to day {getDayOfYear(today)}&thinsp;/&thinsp;
                    {getDaysInYear(viewYear)} ({Math.round(yearFraction * 100)}% of year)
                  </p>
                )}
                <ResponsiveContainer width="100%" height={barChartHeight}>
                  <BarChart
                    layout="vertical"
                    data={categoryData}
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    barCategoryGap="20%"
                    barGap={4}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={fmtCurrencyShort}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) =>
                        typeof value === 'number' ? fmtCurrency(value) : String(value)
                      }
                      labelStyle={{ fontWeight: 600 }}
                      contentStyle={{ fontSize: 13 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 13 }} />
                    <Bar
                      dataKey="budget"
                      name={isCurrentYear ? 'Budget (to date)' : 'Budget'}
                      fill="#94a3b8"
                      radius={[0, 3, 3, 0]}
                    />
                    <Bar dataKey="actual" name="Actual" radius={[0, 3, 3, 0]}>
                      {categoryData.map((entry, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={entry.actual > entry.budget ? '#ef4444' : '#22c55e'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </TabsContent>

          {/* ── Chart 2: Spending breakdown donut chart ── */}
          <TabsContent value="donut" className="mt-4">
            {categoryData.filter((d) => d.actual > 0).length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No spending recorded for this year yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie
                    data={categoryData.filter((d) => d.actual > 0)}
                    dataKey="actual"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      (percent ?? 0) > 0.04
                        ? `${String(name)} (${Math.round((percent ?? 0) * 100)}%)`
                        : ''
                    }
                    labelLine={false}
                  >
                    {categoryData
                      .filter((d) => d.actual > 0)
                      .map((_entry, i) => (
                        <Cell
                          key={`slice-${i}`}
                          fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
                        />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? fmtCurrency(value) : String(value)
                    }
                    contentStyle={{ fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          {/* ── Chart 3: Monthly income vs spending area chart ── */}
          <TabsContent value="trend" className="mt-4">
            {monthlyTrend.every((p) => p.income === 0 && p.spending === 0) ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No transaction data for this year yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSpending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={fmtCurrencyShort}
                    tick={{ fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === 'number' ? fmtCurrency(value) : String(value)
                    }
                    labelStyle={{ fontWeight: 600 }}
                    contentStyle={{ fontSize: 13 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#gradIncome)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="spending"
                    name="Spending"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#gradSpending)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
