'use client';

import { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type BarShapeProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';
import type { DashboardTagBreakdownItem } from '@/types';

/** Resolve a CSS custom property to its computed color string. */
function resolveCssVar(varName: string): string {
  if (typeof window === 'undefined') return '#000';
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function useChartColors() {
  const [colors] = useState(() => ({
    spending: resolveCssVar('--color-amber-600') || '#e17100',
    income: resolveCssVar('--primary') || '#005928',
    positive: '#22c55e',
    negative: '#ef4444',
  }));

  return colors;
}

export type MonthlyTrendPoint = {
  month: string;
  income: number;
  spending: number;
};

type Props = {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  monthlyTrend: MonthlyTrendPoint[];
  spendingByTag: DashboardTagBreakdownItem[];
  sourceTagTotals: DashboardTagBreakdownItem[];
  viewYear: number;
};

const CATEGORY_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#6B7280',
  '#78716C',
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

export function SpendingCharts({
  summaryLines,
  orderedCategories,
  monthlyTrend,
  spendingByTag,
  sourceTagTotals,
  viewYear,
}: Props) {
  const CHART_COLORS = useChartColors();
  const [donutMode, setDonutMode] = useState<'actual' | 'budgeted'>('actual');
  const [tagDonutMode, setTagDonutMode] = useState<'actual' | 'budgeted'>('actual');
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
    categoryData.length > 0 ||
    monthlyTrend.some((p) => p.income > 0 || p.spending > 0) ||
    spendingByTag.length > 0 ||
    sourceTagTotals.length > 0;

  const tagDonutData = useMemo(() => {
    const withSpending = spendingByTag.filter((t) => t.spending > 0);
    if (withSpending.length === 0)
      return [] as Array<{ name: string; value: number; fill: string }>;

    const total = withSpending.reduce((s, t) => s + t.spending, 0);
    if (total <= 0) return [] as Array<{ name: string; value: number; fill: string }>;

    const MIN_SHARE = 0.02;
    const major = withSpending.filter((t) => t.spending / total >= MIN_SHARE);
    const minor = withSpending.filter((t) => t.spending / total < MIN_SHARE);

    const otherTotal = minor.reduce((s, t) => s + t.spending, 0);
    const majorData = major.map((t) => ({ name: t.name, value: t.spending, fill: t.color }));

    if (otherTotal > 0) {
      majorData.push({ name: 'Other', value: otherTotal, fill: '#9CA3AF' });
    }

    return majorData.sort((a, b) => b.value - a.value);
  }, [spendingByTag]);

  const sourceChartData = useMemo(() => {
    return sourceTagTotals
      .filter((t) => t.spending > 0 || t.income > 0 || t.total !== 0)
      .map((t) => ({
        name: t.name,
        spending: Math.round(t.spending),
        income: Math.round(t.income),
        total: Math.abs(Math.round(t.total)),
        totalFill: t.total < 0 ? CHART_COLORS.positive : CHART_COLORS.negative,
      }));
  }, [sourceTagTotals, CHART_COLORS.spending, CHART_COLORS.negative]);

  const categoryDonutData = useMemo(() => {
    return categoryData
      .filter((d) => d.actual > 0)
      .map((d, i) => ({
        ...d,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
  }, [categoryData]);

  const categoryDonutBudgetData = useMemo(() => {
    return categoryData
      .filter((d) => d.budget > 0)
      .map((d, i) => ({
        ...d,
        fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));
  }, [categoryData]);

  // Budget per non-source tag derived from summaryLines (each line may have multiple tags)
  const tagDonutBudgetData = useMemo(() => {
    const tagBudgetMap = new Map<string, { name: string; color: string; budget: number }>();
    for (const line of summaryLines) {
      const lineBudget = Math.round(line.scaledBudget * yearFraction);
      if (lineBudget <= 0) continue;
      for (const tag of line.budgetLine.tags) {
        if (tag.isSource) continue;
        const existing = tagBudgetMap.get(tag.id);
        if (existing) {
          existing.budget += lineBudget;
        } else {
          tagBudgetMap.set(tag.id, { name: tag.name, color: tag.color, budget: lineBudget });
        }
      }
    }
    const entries = Array.from(tagBudgetMap.values()).filter((t) => t.budget > 0);
    if (entries.length === 0) return [] as Array<{ name: string; value: number; fill: string }>;
    const total = entries.reduce((s, t) => s + t.budget, 0);
    const MIN_SHARE = 0.02;
    const major = entries.filter((t) => t.budget / total >= MIN_SHARE);
    const minor = entries.filter((t) => t.budget / total < MIN_SHARE);
    const otherTotal = minor.reduce((s, t) => s + t.budget, 0);
    const result = major.map((t) => ({ name: t.name, value: t.budget, fill: t.color }));
    if (otherTotal > 0) result.push({ name: 'Other', value: otherTotal, fill: '#9CA3AF' });
    return result.sort((a, b) => b.value - a.value);
  }, [summaryLines, yearFraction]);

  if (!hasAnyData) return null;

  // Height for bar chart: 60px per category + margins
  const barChartHeight = Math.max(280, categoryData.length * 60 + 60);
  const sourceBarChartHeight = Math.max(300, sourceChartData.length * 100 + 60);

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
            <TabsTrigger value="tag-donut">Spending by Tag</TabsTrigger>
            <TabsTrigger value="source-bar">Source Tag Breakdown</TabsTrigger>
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
                    <Bar
                      dataKey="actual"
                      name="Actual"
                      radius={[0, 3, 3, 0]}
                      shape={(props: BarShapeProps) => {
                        const { payload, x, y, width, height } = props;
                        const fill =
                          payload.actual > payload.budget
                            ? CHART_COLORS.negative
                            : CHART_COLORS.positive;
                        return (
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill={fill}
                            rx={3}
                            ry={3}
                          />
                        );
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </TabsContent>

          {/* ── Chart 2: Spending breakdown donut chart ── */}
          <TabsContent value="donut" className="mt-4">
            <div className="relative">
              <div className="absolute top-0 left-0 z-10 flex overflow-hidden rounded-md border">
                <button
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${donutMode === 'actual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-transparent'}`}
                  onClick={() => setDonutMode('actual')}
                >
                  Actual
                </button>
                <button
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${donutMode === 'budgeted' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-transparent'}`}
                  onClick={() => setDonutMode('budgeted')}
                >
                  Budgeted
                </button>
              </div>
              {donutMode === 'actual' && categoryDonutData.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No spending recorded for this year yet.
                </p>
              ) : donutMode === 'budgeted' && categoryDonutBudgetData.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No budget data for this year yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={500}>
                  <PieChart>
                    <Pie
                      data={donutMode === 'actual' ? categoryDonutData : categoryDonutBudgetData}
                      dataKey={donutMode === 'actual' ? 'actual' : 'budget'}
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
                    />
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
            </div>
          </TabsContent>

          {/* ── Chart 3: Spending breakdown by tag donut chart ── */}
          <TabsContent value="tag-donut" className="mt-4">
            <div className="relative">
              <div className="absolute top-0 left-0 z-10 flex overflow-hidden rounded-md border">
                <button
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${tagDonutMode === 'actual' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-transparent'}`}
                  onClick={() => setTagDonutMode('actual')}
                >
                  Actual
                </button>
                <button
                  className={`px-2 py-0.5 text-xs font-medium transition-colors ${tagDonutMode === 'budgeted' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground bg-transparent'}`}
                  onClick={() => setTagDonutMode('budgeted')}
                >
                  Budgeted
                </button>
              </div>
              {tagDonutMode === 'actual' && tagDonutData.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No tagged spending recorded for this year yet.
                </p>
              ) : tagDonutMode === 'budgeted' && tagDonutBudgetData.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No tag budget data available for this year.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={500}>
                  <PieChart>
                    <Pie
                      data={tagDonutMode === 'actual' ? tagDonutData : tagDonutBudgetData}
                      dataKey="value"
                      nameKey="name"
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
                    />
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
            </div>
          </TabsContent>

          {/* ── Chart 4: Source tag spending/income/total horizontal bar chart ── */}
          <TabsContent value="source-bar" className="mt-4">
            {sourceChartData.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No source-tagged transactions recorded for this year yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={sourceBarChartHeight}>
                <BarChart
                  layout="vertical"
                  data={sourceChartData}
                  margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  barCategoryGap="24%"
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
                    dataKey="name"
                    width={130}
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
                    dataKey="spending"
                    name="Spending"
                    fill={CHART_COLORS.spending}
                    radius={[0, 3, 3, 0]}
                  />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill={CHART_COLORS.income}
                    radius={[0, 3, 3, 0]}
                  />
                  <Bar
                    dataKey="total"
                    name="Total"
                    radius={[0, 3, 3, 0]}
                    shape={(props: BarShapeProps) => {
                      const { payload, x, y, width, height } = props;
                      return (
                        <rect
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill={payload.totalFill}
                          rx={3}
                          ry={3}
                        />
                      );
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>

          {/* ── Chart 5: Monthly income vs spending area chart ── */}
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
