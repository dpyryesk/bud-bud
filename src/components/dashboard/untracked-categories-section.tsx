'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { UntrackedCategoryDialog } from './untracked-category-dialog';
import { UntrackedTransactionsPanel } from './untracked-transactions-panel';
import type {
  UntrackedCategoryWithSpending,
  UntrackedCategoriesResponse,
  TimePeriod,
  TransactionWithTags,
} from '@/types';
import type { TagOptionWithLevel } from '@/components/budget/constants';

interface UntrackedCategoriesSectionProps {
  budgetId: string | null;
  period: TimePeriod;
  totalYearlyNetIncome: number;
  availableTags: TagOptionWithLevel[];
  onDataChange?: (
    categories: UntrackedCategoryWithSpending[],
    totalTrulyUncategorized: number,
  ) => void;
}

function pct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

export function UntrackedCategoriesSection({
  budgetId,
  period,
  totalYearlyNetIncome,
  availableTags,
  onDataChange,
}: UntrackedCategoriesSectionProps) {
  const [categories, setCategories] = useState<UntrackedCategoryWithSpending[]>([]);
  const [totalTrulyUncategorized, setTotalTrulyUncategorized] = useState(0);
  const [trulyUncategorizedTransactions, setTrulyUncategorizedTransactions] = useState<
    TransactionWithTags[]
  >([]);
  const [loading, setLoading] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<UntrackedCategoryWithSpending | null>(
    null,
  );

  // Sidebar panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelCategory, setPanelCategory] = useState<UntrackedCategoryWithSpending | null>(null);
  const [showingUncategorized, setShowingUncategorized] = useState(false);

  const fetchData = useCallback(async () => {
    if (!budgetId) {
      setCategories([]);
      setTotalTrulyUncategorized(0);
      setTrulyUncategorizedTransactions([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        budgetId,
        start: format(period.start, 'yyyy-MM-dd'),
        end: format(period.end, 'yyyy-MM-dd'),
      });
      const res = await fetch(`/api/untracked-categories?${params}`);
      if (res.ok) {
        const data = (await res.json()) as UntrackedCategoriesResponse;
        setCategories(data.categories);
        setTotalTrulyUncategorized(data.totalTrulyUncategorized);
        setTrulyUncategorizedTransactions(data.trulyUncategorizedTransactions);
        onDataChange?.(data.categories, data.totalTrulyUncategorized);
      }
    } finally {
      setLoading(false);
    }
  }, [budgetId, period, onDataChange]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchData]);

  const handleSuccess = async () => {
    await fetchData();
  };

  const handleEdit = (cat: UntrackedCategoryWithSpending) => {
    setEditingCategory(cat);
    setDialogOpen(true);
  };

  const handleDelete = async (cat: UntrackedCategoryWithSpending) => {
    if (!window.confirm(`Delete untracked category "${cat.name}"?`)) return;
    const res = await fetch(`/api/untracked-categories/${cat.id}`, { method: 'DELETE' });
    if (res.ok) await fetchData();
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingCategory(null);
  };

  const openCategoryPanel = (cat: UntrackedCategoryWithSpending) => {
    setShowingUncategorized(false);
    setPanelCategory(cat);
    setPanelOpen(true);
  };

  const openUncategorizedPanel = () => {
    setShowingUncategorized(true);
    setPanelCategory(null);
    setPanelOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Untracked Spending</CardTitle>
          <Button
            size="sm"
            onClick={() => {
              setEditingCategory(null);
              setDialogOpen(true);
            }}
            disabled={!budgetId}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Category
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : categories.length === 0 && totalTrulyUncategorized === 0 ? (
            <p className="text-muted-foreground text-sm">
              No untracked spending found for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pr-4 pb-2 font-medium">Name</th>
                    <th className="pr-4 pb-2 font-medium">Linked Tags</th>
                    <th className="pr-4 pb-2 text-right font-medium">Amount</th>
                    <th className="pr-4 pb-2 text-right font-medium">% of Income</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <button
                          onClick={() => openCategoryPanel(cat)}
                          className="text-left hover:underline focus:outline-none"
                        >
                          {cat.name}
                        </button>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-1">
                          {cat.tags.map((tag) => (
                            <TagBadge
                              key={tag.id}
                              name={tag.name}
                              color={tag.color}
                              className="text-xs"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatCurrency(cat.actualSpending)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {pct(cat.actualSpending, totalYearlyNetIncome)}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(cat)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive h-7 w-7"
                            onClick={() => void handleDelete(cat)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Truly uncategorized row */}
                  <tr
                    className="hover:bg-muted/30 cursor-pointer border-t"
                    onClick={openUncategorizedPanel}
                  >
                    <td className="py-2 pr-4 font-medium text-amber-600 dark:text-amber-400">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Uncategorized
                      </span>
                    </td>
                    <td className="text-muted-foreground py-2 pr-4 text-xs">
                      Transactions not matched by any category
                    </td>
                    <td className="py-2 pr-4 text-right font-medium text-amber-600 tabular-nums dark:text-amber-400">
                      {formatCurrency(totalTrulyUncategorized)}
                    </td>
                    <td className="py-2 pr-4 text-right text-amber-600 tabular-nums dark:text-amber-400">
                      {pct(totalTrulyUncategorized, totalYearlyNetIncome)}
                    </td>
                    <td className="py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <UntrackedCategoryDialog
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        budgetId={budgetId}
        editingCategory={editingCategory}
        availableTags={availableTags}
        onSuccess={handleSuccess}
      />

      {/* Sidebar panel */}
      <UntrackedTransactionsPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        categoryName={showingUncategorized ? 'Uncategorized' : (panelCategory?.name ?? null)}
        tagIds={showingUncategorized ? null : (panelCategory?.tags.map((t) => t.id) ?? [])}
        preloadedTransactions={showingUncategorized ? trulyUncategorizedTransactions : undefined}
        period={period}
      />
    </>
  );
}
