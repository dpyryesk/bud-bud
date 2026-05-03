'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button } from '@/components/ui/button';
import { buildTagsInDisplayOrder } from '@/lib/tag-tree';
import { cn } from '@/lib/utils';
import { ROW_GRID, type TagOption, type TagOptionWithLevel } from '@/components/budget/constants';
import { SortableCategorySection } from '@/components/budget/sortable-category-section';
import { UncategorizedSection } from '@/components/budget/uncategorized-section';
import { BudgetLineDialog } from '@/components/budget/budget-line-dialog';
import { BudgetCategoryDialog } from '@/components/budget/budget-category-dialog';
import { BudgetSummaryCards } from '@/components/budget/budget-summary-cards';
import { TagTransactionsPanel } from '@/components/budget/tag-transactions-panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BudgetSummaryLine, BudgetCategory, BudgetSummaryResponse, Budget } from '@/types';
import { TransactionsTable } from '@/components/transactions/transactions-table';
import { formatIsoDateForDisplay } from '@/lib/date-utils';

export default function BudgetPage() {
  const { period } = useTimePeriod();

  // Raw data from API
  const [summaryLines, setSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [activeBudget, setActiveBudget] = useState<Budget | null>(null);
  const [tags, setTags] = useState<TagOptionWithLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingTags, setImportingTags] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Untracked spending
  const [totalUntracked, setTotalUntracked] = useState(0);

  // Total income (sum of all credits for the period)
  const [totalIncome, setTotalIncome] = useState(0);

  // Total debits (raw sum of all debit transactions for the period)
  const [totalDebits, setTotalDebits] = useState(0);

  // Ordered display state (managed locally for drag-and-drop)
  const [orderedCategories, setOrderedCategories] = useState<BudgetCategory[]>([]);
  const [groupedLines, setGroupedLines] = useState<Record<string, BudgetSummaryLine[]>>({});
  const [uncategorizedLines, setUncategorizedLines] = useState<BudgetSummaryLine[]>([]);

  // Dialog state — dialogs own their form state internally
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetSummaryLine | null>(null);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);

  // Tag transactions panel state
  const [tagPanelOpen, setTagPanelOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);

  const handleTagClick = (tag: { id: string; name: string; color: string }) => {
    setSelectedTag(tag);
    setTagPanelOpen(true);
  };

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ---- Data fetching ----

  const fetchCategories = useCallback(async (budgetId: string | null) => {
    if (!budgetId) return [];
    const params = new URLSearchParams({ budgetId });
    const res = await fetch(`/api/budget-categories?${params}`);
    const data: BudgetCategory[] = await res.json();
    return data;
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      start: format(period.start, 'yyyy-MM-dd'),
      end: format(period.end, 'yyyy-MM-dd'),
    });
    const res = await fetch(`/api/budget/summary?${params}`);
    if (!res.ok) {
      setSummaryLines([]);
      setActiveBudget(null);
      setTotalIncome(0);
      setTotalDebits(0);
      setLoading(false);
      return {
        activeBudget: null,
        lines: [],
        totalIncome: 0,
        totalDebits: 0,
      } as BudgetSummaryResponse;
    }
    const data: BudgetSummaryResponse = await res.json();
    setSummaryLines(data.lines);
    setActiveBudget(data.activeBudget);
    setTotalIncome(data.totalIncome ?? 0);
    setTotalDebits(data.totalDebits ?? 0);
    setLoading(false);
    return data;
  }, [period]);

  const fetchUntracked = useCallback(async () => {
    const params = new URLSearchParams({
      start: format(period.start, 'yyyy-MM-dd'),
      end: format(period.end, 'yyyy-MM-dd'),
    });
    const res = await fetch(`/api/budget/untracked?${params}`);
    const data: { totalUntracked: number } = await res.json();
    setTotalUntracked(data.totalUntracked);
  }, [period]);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    const categoryTags = data.filter((t: TagOption) => !t.isSource);
    setTags(buildTagsInDisplayOrder(categoryTags));
  }, []);

  const refresh = useCallback(async () => {
    void fetchUntracked();
    const summary = await fetchSummary();
    const lines = summary.lines;
    const cats = await fetchCategories(summary.activeBudget?.id ?? null);
    setOrderedCategories(cats);
    const grouped: Record<string, BudgetSummaryLine[]> = {};
    for (const cat of cats) {
      grouped[cat.id] = lines
        .filter((l) => l.budgetLine.categoryId === cat.id)
        .sort((a, b) => a.budgetLine.order - b.budgetLine.order);
    }
    setGroupedLines(grouped);
    setUncategorizedLines(
      lines
        .filter((l) => l.budgetLine.categoryId === null)
        .sort((a, b) => a.budgetLine.order - b.budgetLine.order),
    );
  }, [fetchCategories, fetchSummary, fetchUntracked]);

  const parseErrorMessage = useCallback(async (res: Response) => {
    try {
      const data = (await res.json()) as { error?: string };
      return data.error ?? `Request failed with status ${res.status}`;
    } catch {
      return `Request failed with status ${res.status}`;
    }
  }, []);

  const ensureOk = useCallback(
    async (res: Response) => {
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res));
      }
    },
    [parseErrorMessage],
  );

  useEffect(() => {
    const id = setTimeout(() => {
      void refresh();
    }, 0);
    return () => clearTimeout(id);
  }, [refresh]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchTags();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchTags]);

  // ---- DnD handlers ----

  const persistCategoryOrder = useCallback(
    async (cats: BudgetCategory[]) => {
      const res = await fetch('/api/budget-categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: cats.map((c, i) => ({ id: c.id, order: i })),
        }),
      });
      await ensureOk(res);
    },
    [ensureOk],
  );

  const persistLineOrder = useCallback(
    async (lines: BudgetSummaryLine[]) => {
      const res = await fetch('/api/budget-lines/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: lines.map((l, i) => ({ id: l.budgetLine.id, order: i })),
        }),
      });
      await ensureOk(res);
    },
    [ensureOk],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = String(active.id);
      const overId = String(over.id);

      // --- Category drag ---
      const activeCatIdx = orderedCategories.findIndex((c) => c.id === activeId);
      if (activeCatIdx !== -1) {
        const overCatIdx = orderedCategories.findIndex((c) => c.id === overId);
        if (overCatIdx !== -1) {
          const previousCats = orderedCategories;
          const newCats = arrayMove(orderedCategories, activeCatIdx, overCatIdx);
          setMutationError(null);
          setOrderedCategories(newCats);
          void persistCategoryOrder(newCats).catch(async (error: unknown) => {
            setOrderedCategories(previousCats);
            await refresh();
            setMutationError(
              error instanceof Error ? error.message : 'Failed to save category order changes.',
            );
          });
        }
        return;
      }

      // --- Line drag within a category ---
      for (const [catId, lines] of Object.entries(groupedLines)) {
        const activeIdx = lines.findIndex((l) => l.budgetLine.id === activeId);
        if (activeIdx !== -1) {
          const overIdx = lines.findIndex((l) => l.budgetLine.id === overId);
          if (overIdx !== -1) {
            const previousLines = lines;
            const newLines = arrayMove(lines, activeIdx, overIdx);
            setMutationError(null);
            setGroupedLines((prev) => ({ ...prev, [catId]: newLines }));
            void persistLineOrder(newLines).catch(async (error: unknown) => {
              setGroupedLines((prev) => ({ ...prev, [catId]: previousLines }));
              await refresh();
              setMutationError(
                error instanceof Error
                  ? error.message
                  : 'Failed to save budget line order changes.',
              );
            });
          }
          return;
        }
      }

      // --- Line drag within uncategorized ---
      const uncatActiveIdx = uncategorizedLines.findIndex((l) => l.budgetLine.id === activeId);
      if (uncatActiveIdx !== -1) {
        const uncatOverIdx = uncategorizedLines.findIndex((l) => l.budgetLine.id === overId);
        if (uncatOverIdx !== -1) {
          const previousLines = uncategorizedLines;
          const newLines = arrayMove(uncategorizedLines, uncatActiveIdx, uncatOverIdx);
          setMutationError(null);
          setUncategorizedLines(newLines);
          void persistLineOrder(newLines).catch(async (error: unknown) => {
            setUncategorizedLines(previousLines);
            await refresh();
            setMutationError(
              error instanceof Error ? error.message : 'Failed to save budget line order changes.',
            );
          });
        }
      }
    },
    [
      orderedCategories,
      groupedLines,
      uncategorizedLines,
      persistCategoryOrder,
      persistLineOrder,
      refresh,
    ],
  );

  // ---- Budget line actions ----

  const handleEditLine = (line: BudgetSummaryLine) => {
    setEditingLine(line);
    setLineDialogOpen(true);
  };

  const handleDeleteLine = async (id: string) => {
    if (!confirm('Delete this budget line?')) return;
    setMutationError(null);
    try {
      const res = await fetch(`/api/budget-lines/${id}`, { method: 'DELETE' });
      await ensureOk(res);
      await refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to delete budget line.');
    }
  };

  const handleLineSuccess = async () => {
    setMutationError(null);
    setEditingLine(null);
    await refresh();
  };

  // ---- Category actions ----

  const handleEditCategory = (cat: BudgetCategory) => {
    setEditingCategory(cat);
    setCatDialogOpen(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category? Budget lines in it will become uncategorized.')) return;
    setMutationError(null);
    try {
      const res = await fetch(`/api/budget-categories/${id}`, { method: 'DELETE' });
      await ensureOk(res);
      await refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to delete category.');
    }
  };

  const handleCategorySuccess = async () => {
    setMutationError(null);
    setEditingCategory(null);
    await refresh();
  };

  const handleImportTags = useCallback(async () => {
    if (!activeBudget) return;

    setImportingTags(true);
    setMutationError(null);

    const normalizeName = (name: string) => name.trim().toLocaleLowerCase();

    const existingNames = new Set<string>([
      ...orderedCategories.map((c) => normalizeName(c.name)),
      ...summaryLines.map((l) => normalizeName(l.budgetLine.name)),
    ]);

    const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
    const childrenByParentId = new Map<string, TagOptionWithLevel[]>();

    for (const tag of tags) {
      if (!tag.parentId) continue;
      const existing = childrenByParentId.get(tag.parentId) ?? [];
      existing.push(tag);
      childrenByParentId.set(tag.parentId, existing);
    }

    try {
      const categoryIdByTagId = new Map<string, string>();
      const categoryIdByNormalizedName = new Map<string, string>(
        orderedCategories.map((category) => [normalizeName(category.name), category.id]),
      );

      for (const tag of tags) {
        if (tag.level >= 2) continue;

        const children = (childrenByParentId.get(tag.id) ?? []).filter((child) => child.level <= 1);
        const hasChildren = children.length > 0;
        if (!hasChildren) continue;

        const normalizedTagName = normalizeName(tag.name);
        if (existingNames.has(normalizedTagName)) {
          const existingCategoryId = categoryIdByNormalizedName.get(normalizedTagName);
          if (existingCategoryId) {
            categoryIdByTagId.set(tag.id, existingCategoryId);
          }
          continue;
        }

        const categoryRes = await fetch('/api/budget-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tag.name, budgetId: activeBudget.id }),
        });
        await ensureOk(categoryRes);
        const createdCategory = (await categoryRes.json()) as BudgetCategory;
        categoryIdByTagId.set(tag.id, createdCategory.id);
        categoryIdByNormalizedName.set(normalizedTagName, createdCategory.id);
        existingNames.add(normalizedTagName);
      }

      for (const tag of tags) {
        if (tag.level >= 2) continue;

        const children = (childrenByParentId.get(tag.id) ?? []).filter((child) => child.level <= 1);
        const hasChildren = children.length > 0;

        if (hasChildren) {
          const categoryId = categoryIdByTagId.get(tag.id);
          if (!categoryId) continue;

          for (const child of children) {
            const normalizedChildName = normalizeName(child.name);
            if (existingNames.has(normalizedChildName)) continue;

            const lineRes = await fetch('/api/budget-lines', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: child.name,
                period: 'monthly',
                amount: 100,
                rollover: false,
                tagIds: [child.id],
                categoryId,
                budgetId: activeBudget.id,
              }),
            });
            await ensureOk(lineRes);
            existingNames.add(normalizedChildName);
          }
          continue;
        }

        const parentExists = !!(tag.parentId && tagsById.has(tag.parentId));
        if (parentExists) continue;

        const normalizedTagName = normalizeName(tag.name);
        if (existingNames.has(normalizedTagName)) continue;

        const lineRes = await fetch('/api/budget-lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tag.name,
            period: 'monthly',
            amount: 100,
            rollover: false,
            tagIds: [tag.id],
            categoryId: null,
            budgetId: activeBudget.id,
          }),
        });
        await ensureOk(lineRes);
        existingNames.add(normalizedTagName);
      }

      await refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to import tags.');
    } finally {
      setImportingTags(false);
    }
  }, [activeBudget, ensureOk, orderedCategories, refresh, summaryLines, tags]);

  // ---- Totals ----

  const totalBudget = summaryLines.reduce((s, l) => s + l.scaledBudget, 0);
  const totalActual = summaryLines.reduce((s, l) => s + l.actualSpending, 0);
  const totalRemaining = summaryLines.reduce((s, l) => s + l.remaining, 0);

  const allLineIds = [
    ...orderedCategories.flatMap((c) => (groupedLines[c.id] ?? []).map((l) => l.budgetLine.id)),
    ...uncategorizedLines.map((l) => l.budgetLine.id),
  ];

  // ---- Render ----

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Budget</h1>
          <p className="text-muted-foreground text-sm">Viewing: {period.label}</p>
          <p className="text-muted-foreground text-sm">
            <Link href="/budgets" className="underline underline-offset-4 hover:no-underline">
              {activeBudget
                ? `Budget effective ${formatIsoDateForDisplay(activeBudget.startDate)}`
                : 'No budget — manage budgets'}
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void handleImportTags()}
            disabled={activeBudget === null || loading || importingTags}
            title="Import Tags"
          >
            Import Tags
          </Button>

          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh()}
            disabled={loading || importingTags}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>

          <BudgetCategoryDialog
            open={catDialogOpen}
            budgetId={activeBudget?.id ?? null}
            triggerDisabled={activeBudget === null}
            triggerTooltip="Create or activate a budget first"
            onOpenChange={(open) => {
              setCatDialogOpen(open);
              if (!open) setEditingCategory(null);
            }}
            editingCategory={editingCategory}
            onSuccess={handleCategorySuccess}
          />

          <BudgetLineDialog
            open={lineDialogOpen}
            budgetId={activeBudget?.id ?? null}
            triggerDisabled={activeBudget === null}
            triggerTooltip="Create or activate a budget first"
            onOpenChange={(open) => {
              setLineDialogOpen(open);
              if (!open) setEditingLine(null);
            }}
            editingLine={editingLine}
            categories={orderedCategories}
            tags={tags}
            onSuccess={handleLineSuccess}
          />
        </div>
      </div>

      {mutationError && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {mutationError}
        </p>
      )}

      {/* Summary Cards */}
      <BudgetSummaryCards
        totalBudget={totalBudget}
        totalActual={totalActual}
        totalRemaining={totalRemaining}
        totalUntracked={totalUntracked}
        totalIncome={totalIncome}
        totalDebits={totalDebits}
      />

      {/* Budget Lines Table */}
      <div className="rounded-md border">
        {/* Column headers */}
        <div
          className={cn(
            ROW_GRID,
            'text-muted-foreground border-b px-3 py-2 text-xs font-medium tracking-wider uppercase',
          )}
        >
          <div /> {/* drag col */}
          <div>Name</div>
          <div>Tags</div>
          <div>Period</div>
          <div className="text-right">Budget</div>
          <div className="text-right">Rollover</div>
          <div className="text-right">Actual</div>
          <div className="text-right">Remaining</div>
          <div />
        </div>

        {loading ? (
          /* Loading skeleton */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(ROW_GRID, 'border-b px-3 py-2 last:border-b-0')}>
              {Array.from({ length: 9 }).map((__, j) => (
                <div key={j} className="bg-muted h-4 animate-pulse rounded" />
              ))}
            </div>
          ))
        ) : summaryLines.length === 0 && orderedCategories.length === 0 ? (
          <div className="text-muted-foreground py-10 text-center text-sm">
            No budget lines yet. Create a category and add budget lines to start tracking.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {/* Sortable category sections */}
            <SortableContext
              items={orderedCategories.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedCategories.map((cat) => (
                <SortableCategorySection
                  key={cat.id}
                  category={cat}
                  lines={groupedLines[cat.id] ?? []}
                  onEditCategory={handleEditCategory}
                  onDeleteCategory={(id) => void handleDeleteCategory(id)}
                  onEditLine={handleEditLine}
                  onDeleteLine={(id) => void handleDeleteLine(id)}
                  onTagClick={handleTagClick}
                />
              ))}
            </SortableContext>

            {/* Uncategorized section — always at the bottom, not reorderable */}
            {(uncategorizedLines.length > 0 || allLineIds.length === 0) && (
              <UncategorizedSection
                lines={uncategorizedLines}
                onEditLine={handleEditLine}
                onDeleteLine={(id) => void handleDeleteLine(id)}
                onTagClick={handleTagClick}
              />
            )}
          </DndContext>
        )}
      </div>

      {/* Untracked Transactions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Untracked Transactions</CardTitle>
          <p className="text-muted-foreground text-sm">
            Debit transactions with no tag or with a tag not assigned to any budget line.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <TransactionsTable extraParams={{ unbudgeted: 'true' }} />
        </CardContent>
      </Card>

      {/* Tag transactions panel */}
      <TagTransactionsPanel
        open={tagPanelOpen}
        onOpenChange={(open) => {
          setTagPanelOpen(open);
          if (!open) setSelectedTag(null);
        }}
        tag={selectedTag}
        period={period}
      />
    </div>
  );
}
