'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useTimePeriod } from '@/hooks/use-time-period';
import { getYearlyAmount } from '@/lib/date-utils';
import { buildTagsInDisplayOrder } from '@/lib/tag-tree';
import { IncomeSourcesCard } from '@/components/dashboard/income-sources-card';
import { ExpensesTable } from '@/components/dashboard/expenses-table';
import { UntrackedCategoriesSection } from '@/components/dashboard/untracked-categories-section';
import type {
  BudgetSummaryResponse,
  Budget,
  BudgetSummaryLine,
  BudgetCategory,
  IncomeSource,
} from '@/types';
import type { TagOption, TagOptionWithLevel } from '@/components/budget/constants';

export default function DashboardPage() {
  const { period } = useTimePeriod();

  // Budget summary data
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [summaryLines, setSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [loading, setLoading] = useState(false);

  // Income sources
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);

  // Tags for UntrackedCategoryDialog
  const [tags, setTags] = useState<TagOptionWithLevel[]>([]);

  // ---- Derived values ----

  const orderedCategories: BudgetCategory[] = [];
  const seenCatIds = new Set<string>();
  for (const line of summaryLines) {
    if (line.budgetLine.category && !seenCatIds.has(line.budgetLine.category.id)) {
      orderedCategories.push(line.budgetLine.category);
      seenCatIds.add(line.budgetLine.category.id);
    }
  }
  orderedCategories.sort((a, b) => a.order - b.order);

  const totalYearlyNetIncome = incomeSources.reduce(
    (sum, src) => sum + getYearlyAmount(src.netAmount, src.netPeriod),
    0,
  );

  const totalYearlyBudget = summaryLines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );

  // ---- Data fetching ----

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        start: format(period.start, 'yyyy-MM-dd'),
        end: format(period.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/budget/summary?${params}`);
      if (!res.ok) {
        setSummaryLines([]);
        setActiveBudget(null);
        return;
      }
      const data = (await res.json()) as BudgetSummaryResponse;
      setActiveBudget(data.activeBudget);
      setSummaryLines(data.lines ?? []);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchIncomeSources = useCallback(async (budgetId: string) => {
    const res = await fetch(`/api/income-sources?budgetId=${budgetId}`);
    if (res.ok) {
      setIncomeSources((await res.json()) as IncomeSource[]);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    if (!res.ok) return;
    const data = (await res.json()) as TagOption[];
    const categoryTags = data.filter((t) => !t.isSource);
    setTags(buildTagsInDisplayOrder(categoryTags));
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchSummary();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSummary]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!activeBudget) {
        setIncomeSources([]);
        return;
      }
      void fetchIncomeSources(activeBudget.id);
    }, 0);
    return () => clearTimeout(id);
  }, [activeBudget, fetchIncomeSources]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchTags();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchTags]);

  // ---- Render ----

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Showing data for: {period.label}</p>

      {!loading && !activeBudget ? (
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
          {/* 1. Expected Income */}
          <IncomeSourcesCard incomeSources={incomeSources} totalYearlyBudget={totalYearlyBudget} />

          {/* 2. Table of Expenses */}
          <ExpensesTable
            summaryLines={summaryLines}
            orderedCategories={orderedCategories}
            totalYearlyNetIncome={totalYearlyNetIncome}
            onLineUpdated={fetchSummary}
          />

          {/* 3. Untracked Categories */}
          <UntrackedCategoriesSection
            budgetId={activeBudget?.id ?? null}
            period={period}
            totalYearlyNetIncome={totalYearlyNetIncome}
            availableTags={tags}
          />
        </>
      )}
    </div>
  );
}
