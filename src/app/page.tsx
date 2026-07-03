'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, startOfYear, endOfYear } from 'date-fns';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { useTimePeriod } from '@/hooks/use-time-period';
import { getYearlyAmount } from '@/lib/date-utils';
import { IncomeSourcesCard } from '@/components/dashboard/income-sources-card';
import { ExpensesTable } from '@/components/dashboard/expenses-table';
import { SpendingCharts, type MonthlyTrendPoint } from '@/components/dashboard/spending-charts';
import { BudgetSummaryCards } from '@/components/budget/budget-summary-cards';
import {
  SummaryTransactionsPanel,
  type SummaryCardType,
} from '@/components/dashboard/summary-transactions-panel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type {
  BudgetSummaryResponse,
  Budget,
  BudgetSummaryLine,
  BudgetCategory,
  DashboardSummaryResponse,
  DashboardTagBreakdownItem,
  IncomeSource,
  TimePeriod,
} from '@/types';

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard…">
      {/* Budget cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="bg-muted mb-2 h-4 w-28 animate-pulse rounded" />
              <div className="bg-muted h-7 w-20 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Income card skeleton */}
      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-36 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="bg-muted h-4 w-32 animate-pulse rounded" />
              <div className="bg-muted h-4 w-20 animate-pulse rounded" />
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
      {/* Expenses table skeleton */}
      <Card>
        <CardHeader>
          <div className="bg-muted h-5 w-40 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="bg-muted h-4 w-28 animate-pulse rounded" />
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
              <div className="bg-muted h-4 w-16 animate-pulse rounded" />
              <div className="bg-muted h-4 w-20 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const { period } = useTimePeriod();

  // Always operate on the full calendar year of the selected period
  const yearPeriod = useMemo(() => {
    const yr = period.start.getFullYear();
    return {
      start: startOfYear(period.start),
      end: endOfYear(period.start),
      label: String(yr),
      type: 'year' as const,
    };
  }, [period]);

  // ---- State ----

  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Panel state for summary card drilldown
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeCardType, setActiveCardType] = useState<SummaryCardType | null>(null);
  const [activePanelPeriod, setActivePanelPeriod] = useState<TimePeriod | null>(null);

  // Yearly summary
  const [yearSummaryLines, setYearSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [yearTotalIncome, setYearTotalIncome] = useState(0);
  const [yearTotalDebits, setYearTotalDebits] = useState(0);
  const [yearTotalUntracked, setYearTotalUntracked] = useState(0);

  // Period-specific summary
  const [periodActiveBudget, setPeriodActiveBudget] = useState<Budget | null>(null);
  const [periodSummaryLines, setPeriodSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [periodTotalIncome, setPeriodTotalIncome] = useState(0);
  const [periodTotalDebits, setPeriodTotalDebits] = useState(0);
  const [periodTotalUntracked, setPeriodTotalUntracked] = useState(0);

  // Income sources
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  // Monthly trend (for charts)
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrendPoint[]>([]);
  const [spendingByTag, setSpendingByTag] = useState<DashboardTagBreakdownItem[]>([]);
  const [sourceTagTotals, setSourceTagTotals] = useState<DashboardTagBreakdownItem[]>([]);

  // ---- Derived values ----

  // Categories ordered for the year-at-a-glance charts (uses yearly lines)
  const orderedCategories: BudgetCategory[] = [];
  const seenCatIds = new Set<string>();
  for (const line of yearSummaryLines) {
    if (line.budgetLine.category && !seenCatIds.has(line.budgetLine.category.id)) {
      orderedCategories.push(line.budgetLine.category);
      seenCatIds.add(line.budgetLine.category.id);
    }
  }
  orderedCategories.sort((a, b) => a.order - b.order);

  // Categories ordered for the Budget Expenses table (uses period lines — correct budget)
  const periodOrderedCategories: BudgetCategory[] = [];
  const seenPeriodCatIds = new Set<string>();
  for (const line of periodSummaryLines) {
    if (line.budgetLine.category && !seenPeriodCatIds.has(line.budgetLine.category.id)) {
      periodOrderedCategories.push(line.budgetLine.category);
      seenPeriodCatIds.add(line.budgetLine.category.id);
    }
  }
  periodOrderedCategories.sort((a, b) => a.order - b.order);

  const totalYearlyNetIncome = incomeSources.reduce(
    (sum, src) => sum + getYearlyAmount(src.netAmount, src.netPeriod),
    0,
  );

  const yearCardTotals = useMemo(
    () => ({
      totalBudget: yearSummaryLines.reduce((s, l) => s + l.scaledBudget, 0),
      totalActual: yearSummaryLines.reduce((s, l) => s + l.actualSpending, 0),
      totalRemaining: yearSummaryLines.reduce((s, l) => s + l.remaining, 0),
    }),
    [yearSummaryLines],
  );

  const periodCardTotals = useMemo(
    () => ({
      totalBudget: periodSummaryLines.reduce((s, l) => s + l.scaledBudget, 0),
      totalActual: periodSummaryLines.reduce((s, l) => s + l.actualSpending, 0),
      totalRemaining: periodSummaryLines.reduce((s, l) => s + l.remaining, 0),
    }),
    [periodSummaryLines],
  );

  // ---- Data fetching ----

  const fetchYearlySummary = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({
        start: format(yearPeriod.start, 'yyyy-MM-dd'),
        end: format(yearPeriod.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/budget/summary?${params}`);
      if (!res.ok) {
        setYearSummaryLines([]);
        setActiveBudget(null);
        setYearTotalIncome(0);
        setYearTotalDebits(0);
        if (res.status !== 404) {
          setFetchError(`Failed to load budget data (${res.status})`);
        }
        return;
      }
      const data = (await res.json()) as BudgetSummaryResponse;
      setActiveBudget(data.activeBudget);
      setYearSummaryLines(data.lines ?? []);
      setYearTotalIncome(data.totalIncome ?? 0);
      setYearTotalDebits(data.totalDebits ?? 0);
    } catch {
      setYearSummaryLines([]);
      setActiveBudget(null);
      setFetchError('Unable to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [yearPeriod]);

  const fetchPeriodSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        start: format(period.start, 'yyyy-MM-dd'),
        end: format(period.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/budget/summary?${params}`);
      if (!res.ok) {
        setPeriodActiveBudget(null);
        setPeriodSummaryLines([]);
        setPeriodTotalIncome(0);
        setPeriodTotalDebits(0);
        return;
      }
      const data = (await res.json()) as BudgetSummaryResponse;
      setPeriodActiveBudget(data.activeBudget);
      setPeriodSummaryLines(data.lines ?? []);
      setPeriodTotalIncome(data.totalIncome ?? 0);
      setPeriodTotalDebits(data.totalDebits ?? 0);
    } catch {
      setPeriodActiveBudget(null);
      setPeriodSummaryLines([]);
      setPeriodTotalIncome(0);
      setPeriodTotalDebits(0);
    }
  }, [period]);

  const fetchUntracked = useCallback(
    async (start: Date, end: Date, setter: (v: number) => void) => {
      try {
        const params = new URLSearchParams({
          start: format(start, 'yyyy-MM-dd'),
          end: format(end, 'yyyy-MM-dd'),
        });
        const res = await fetch(`/api/budget/untracked?${params}`);
        if (!res.ok) {
          setter(0);
          return;
        }
        const data: { totalUntracked: number } = await res.json();
        setter(data.totalUntracked);
      } catch {
        setter(0);
      }
    },
    [],
  );

  const fetchIncomeSources = useCallback(async (budgetId: string) => {
    try {
      const res = await fetch(`/api/income-sources?budgetId=${budgetId}`);
      if (res.ok) {
        setIncomeSources((await res.json()) as IncomeSource[]);
      }
    } catch {
      // non-critical — income sources just won't display
    }
  }, []);

  const fetchMonthlyTrend = useCallback(async () => {
    try {
      const year = yearPeriod.start.getFullYear();
      const res = await fetch(`/api/dashboard/monthly-trend?year=${year}`);
      if (res.ok) {
        setMonthlyTrend((await res.json()) as MonthlyTrendPoint[]);
      }
    } catch {
      // non-critical — charts just won't display trend
    }
  }, [yearPeriod]);

  const fetchDashboardSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        start: format(yearPeriod.start, 'yyyy-MM-dd'),
        end: format(yearPeriod.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/dashboard?${params}`);
      if (!res.ok) {
        setSpendingByTag([]);
        setSourceTagTotals([]);
        return;
      }
      const data = (await res.json()) as DashboardSummaryResponse;
      setSpendingByTag(data.spendingByTag ?? []);
      setSourceTagTotals(data.sourceTagTotals ?? []);
    } catch {
      setSpendingByTag([]);
      setSourceTagTotals([]);
    }
  }, [yearPeriod]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchYearlySummary();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchYearlySummary]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchPeriodSummary();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchPeriodSummary]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchUntracked(yearPeriod.start, yearPeriod.end, setYearTotalUntracked);
    }, 0);
    return () => clearTimeout(id);
  }, [fetchUntracked, yearPeriod]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchUntracked(period.start, period.end, setPeriodTotalUntracked);
    }, 0);
    return () => clearTimeout(id);
  }, [fetchUntracked, period]);

  useEffect(() => {
    const id = setTimeout(() => {
      // Use the budget applicable to the selected period, not the yearly budget,
      // so the income sources always match the currently selected date.
      const budgetForPeriod = periodActiveBudget ?? activeBudget;
      if (!budgetForPeriod) {
        setIncomeSources([]);
        return;
      }
      void fetchIncomeSources(budgetForPeriod.id);
    }, 0);
    return () => clearTimeout(id);
  }, [periodActiveBudget, activeBudget, fetchIncomeSources]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchMonthlyTrend();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchMonthlyTrend]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchDashboardSummary();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchDashboardSummary]);

  // ---- Handlers ----

  const handlePeriodCardClick = useCallback(
    (type: SummaryCardType) => {
      setActiveCardType(type);
      setActivePanelPeriod(period);
      setPanelOpen(true);
    },
    [period],
  );

  const handleYearCardClick = useCallback(
    (type: SummaryCardType) => {
      setActiveCardType(type);
      setActivePanelPeriod(yearPeriod);
      setPanelOpen(true);
    },
    [yearPeriod],
  );

  // ---- Render ----

  return (
    <div className="space-y-6">
      <div className="border-primary border-l-[3px] pl-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Showing data for: {yearPeriod.label}</p>
      </div>

      {fetchError && (
        <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}

      {loading ? (
        <DashboardSkeleton />
      ) : !activeBudget ? (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No budget configured.</p>
          <p className="mt-1 text-sm">
            Go to{' '}
            <Link href="/budgets" className="text-primary underline">
              Budgets
            </Link>{' '}
            to create a budget and start tracking your finances.
          </p>
        </div>
      ) : (
        <>
          {/* 1a. Budget Summary Cards — selected period */}
          <div>
            <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
              {period.label}
            </h2>
            <BudgetSummaryCards
              totalBudget={periodCardTotals.totalBudget}
              totalActual={periodCardTotals.totalActual}
              totalRemaining={periodCardTotals.totalRemaining}
              totalUntracked={periodTotalUntracked}
              totalIncome={periodTotalIncome}
              totalDebits={periodTotalDebits}
              onCardClick={handlePeriodCardClick}
            />
          </div>

          {/* 1b. Budget Summary Cards — full year */}
          <div>
            <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
              Full Year {yearPeriod.label}
            </h2>
            <BudgetSummaryCards
              totalBudget={yearCardTotals.totalBudget}
              totalActual={yearCardTotals.totalActual}
              totalRemaining={yearCardTotals.totalRemaining}
              totalUntracked={yearTotalUntracked}
              totalIncome={yearTotalIncome}
              totalDebits={yearTotalDebits}
              onCardClick={handleYearCardClick}
            />
          </div>

          {/* 2. Year-at-a-glance charts */}
          <SpendingCharts
            summaryLines={yearSummaryLines}
            orderedCategories={orderedCategories}
            monthlyTrend={monthlyTrend}
            spendingByTag={spendingByTag}
            sourceTagTotals={sourceTagTotals}
            viewYear={yearPeriod.start.getFullYear()}
          />

          {/* 3. Expected Income */}
          <IncomeSourcesCard incomeSources={incomeSources} />

          {/* 4. Table of Expenses — driven by period lines so the correct budget is always shown */}
          <ExpensesTable
            summaryLines={periodSummaryLines}
            orderedCategories={periodOrderedCategories}
            totalYearlyNetIncome={totalYearlyNetIncome}
            periodSummaryLines={periodSummaryLines}
            periodLabel={period.label}
          />
        </>
      )}

      {/* Summary card drilldown panel */}
      <SummaryTransactionsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        cardType={activeCardType}
        period={activePanelPeriod}
      />
    </div>
  );
}
