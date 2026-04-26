'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, GripVertical, FolderPlus } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

// ---- Types ----
type TagOption = { id: string; name: string; color: string; isSource: boolean };

// ---- Grid layout shared by header, category, and line rows ----
const ROW_GRID =
  'grid grid-cols-[2rem_minmax(8rem,1fr)_minmax(8rem,1fr)_5rem_7rem_7rem_7rem_5rem] items-center gap-x-3';

// ---- SortableLineRow ----
function SortableLineRow({
  line,
  onEdit,
  onDelete,
}: {
  line: BudgetSummaryLine;
  onEdit: (line: BudgetSummaryLine) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: line.budgetLine.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn(
        ROW_GRID,
        'hover:bg-muted/20 border-b px-3 py-2 text-sm last:border-b-0',
        isDragging && 'bg-muted/30',
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Name */}
      <div className="min-w-0">
        <span className="font-medium">{line.budgetLine.name}</span>
        {line.budgetLine.rollover && (
          <span className="text-muted-foreground ml-1 text-xs" title="Rollover enabled">
            🔄
          </span>
        )}
        {line.rolloverAmount !== 0 && (
          <div className="text-muted-foreground truncate text-xs">
            Rollover: {formatCurrency(line.rolloverAmount)}
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="flex min-w-0 flex-wrap gap-1">
        {line.budgetLine.tags.map((t) => (
          <TagBadge key={t.id} name={t.name} color={t.color} className="text-xs" />
        ))}
      </div>

      {/* Period */}
      <div className="text-muted-foreground capitalize">{line.budgetLine.period}</div>

      {/* Budget */}
      <div className="text-right tabular-nums">{formatCurrency(line.effectiveBudget)}</div>

      {/* Actual */}
      <div className="text-right tabular-nums">{formatCurrency(line.actualSpending)}</div>

      {/* Remaining */}
      <div
        className={cn(
          'text-right font-medium tabular-nums',
          line.remaining >= 0 ? 'text-green-600' : 'text-red-600',
        )}
      >
        {formatCurrency(line.remaining)}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(line)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive h-7 w-7"
          onClick={() => onDelete(line.budgetLine.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ---- SortableCategorySection ----
function SortableCategorySection({
  category,
  lines,
  onEditCategory,
  onDeleteCategory,
  onEditLine,
  onDeleteLine,
}: {
  category: BudgetCategory;
  lines: BudgetSummaryLine[];
  onEditCategory: (cat: BudgetCategory) => void;
  onDeleteCategory: (id: string) => void;
  onEditLine: (line: BudgetSummaryLine) => void;
  onDeleteLine: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const subtotalBudget = lines.reduce((s, l) => s + l.effectiveBudget, 0);
  const subtotalActual = lines.reduce((s, l) => s + l.actualSpending, 0);
  const subtotalRemaining = subtotalBudget - subtotalActual;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={cn('border-b last:border-b-0', isDragging && 'bg-muted/30')}
    >
      {/* Category header row */}
      <div className={cn(ROW_GRID, 'bg-muted/50 px-3 py-2 font-semibold')}>
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground hover:text-foreground cursor-grab touch-none"
          aria-label="Drag to reorder category"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Category name spans name + tags + period columns */}
        <div className="col-span-3 flex items-center gap-2 text-sm">
          <span>{category.name}</span>
          {lines.length === 0 && (
            <span className="text-muted-foreground text-xs font-normal">(empty)</span>
          )}
        </div>

        {/* Subtotals */}
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalBudget)}</div>
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalActual)}</div>
        <div
          className={cn(
            'text-right text-sm font-semibold tabular-nums',
            subtotalRemaining >= 0 ? 'text-green-600' : 'text-red-600',
          )}
        >
          {formatCurrency(subtotalRemaining)}
        </div>

        {/* Category actions */}
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEditCategory(category)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive h-7 w-7"
            onClick={() => onDeleteCategory(category.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Lines within this category */}
      <SortableContext
        items={lines.map((l) => l.budgetLine.id)}
        strategy={verticalListSortingStrategy}
      >
        {lines.map((line) => (
          <SortableLineRow
            key={line.budgetLine.id}
            line={line}
            onEdit={onEditLine}
            onDelete={onDeleteLine}
          />
        ))}
      </SortableContext>
    </div>
  );
}

// ---- UncategorizedSection ----
function UncategorizedSection({
  lines,
  onEditLine,
  onDeleteLine,
}: {
  lines: BudgetSummaryLine[];
  onEditLine: (line: BudgetSummaryLine) => void;
  onDeleteLine: (id: string) => void;
}) {
  const subtotalBudget = lines.reduce((s, l) => s + l.effectiveBudget, 0);
  const subtotalActual = lines.reduce((s, l) => s + l.actualSpending, 0);
  const subtotalRemaining = subtotalBudget - subtotalActual;

  return (
    <div className="border-b last:border-b-0">
      {/* Uncategorized header */}
      <div className={cn(ROW_GRID, 'bg-muted/30 px-3 py-2 font-semibold')}>
        <div /> {/* no drag handle */}
        <div className="text-muted-foreground col-span-3 text-sm">Uncategorized</div>
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalBudget)}</div>
        <div className="text-right text-sm tabular-nums">{formatCurrency(subtotalActual)}</div>
        <div
          className={cn(
            'text-right text-sm font-semibold tabular-nums',
            subtotalRemaining >= 0 ? 'text-green-600' : 'text-red-600',
          )}
        >
          {formatCurrency(subtotalRemaining)}
        </div>
        <div /> {/* no actions */}
      </div>
      <SortableContext
        items={lines.map((l) => l.budgetLine.id)}
        strategy={verticalListSortingStrategy}
      >
        {lines.map((line) => (
          <SortableLineRow
            key={line.budgetLine.id}
            line={line}
            onEdit={onEditLine}
            onDelete={onDeleteLine}
          />
        ))}
      </SortableContext>
    </div>
  );
}

// ---- Main Page ----
export default function BudgetPage() {
  const { period } = useTimePeriod();

  // Raw data from API
  const [summaryLines, setSummaryLines] = useState<BudgetSummaryLine[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Ordered display state (managed locally for drag-and-drop)
  const [orderedCategories, setOrderedCategories] = useState<BudgetCategory[]>([]);
  const [groupedLines, setGroupedLines] = useState<Record<string, BudgetSummaryLine[]>>({});
  const [uncategorizedLines, setUncategorizedLines] = useState<BudgetSummaryLine[]>([]);

  // Budget line form state
  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPeriod, setFormPeriod] = useState('monthly');
  const [formAmount, setFormAmount] = useState('');
  const [formRollover, setFormRollover] = useState(false);
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formCategoryId, setFormCategoryId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Category form state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormError, setCatFormError] = useState<string | null>(null);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // ---- Data fetching ----

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/budget-categories');
    const data: BudgetCategory[] = await res.json();
    return data;
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const res = await fetch(`/api/budget/summary?${params}`);
    const data: BudgetSummaryLine[] = await res.json();
    setSummaryLines(data);
    setLoading(false);
    return data;
  }, [period]);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data.filter((t: TagOption) => !t.isSource));
  }, []);

  const refresh = useCallback(async () => {
    const [cats, lines] = await Promise.all([fetchCategories(), fetchSummary()]);
    // Build ordered display state
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
  }, [fetchCategories, fetchSummary]);

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
    [orderedCategories, groupedLines, uncategorizedLines, persistCategoryOrder, persistLineOrder],
  );

  // ---- Budget line CRUD ----

  const resetLineForm = () => {
    setFormName('');
    setFormPeriod('monthly');
    setFormAmount('');
    setFormRollover(false);
    setFormTagIds([]);
    setFormCategoryId(null);
    setEditingLineId(null);
    setFormError(null);
  };

  const handleEditLine = (line: BudgetSummaryLine) => {
    setEditingLineId(line.budgetLine.id);
    setFormName(line.budgetLine.name);
    setFormPeriod(line.budgetLine.period);
    setFormAmount(line.budgetLine.amount.toString());
    setFormRollover(line.budgetLine.rollover);
    setFormTagIds(line.budgetLine.tags.map((t) => t.id));
    setFormCategoryId(line.budgetLine.categoryId ?? null);
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

  const handleLineSubmit = async () => {
    setFormError(null);
    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
    const parsedAmount = parseFloat(formAmount);
    if (!formAmount || isNaN(parsedAmount) || parsedAmount < 0) {
      setFormError('Amount must be a valid non-negative number.');
      return;
    }

    const payload = {
      name: formName.trim(),
      period: formPeriod,
      amount: formAmount,
      rollover: formRollover,
      tagIds: formTagIds,
      categoryId: formCategoryId,
    };

    if (editingLineId) {
      setMutationError(null);
      const res = await fetch(`/api/budget-lines/${editingLineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      try {
        await ensureOk(res);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to update budget line.');
        return;
      }
    } else {
      setMutationError(null);
      const res = await fetch('/api/budget-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      try {
        await ensureOk(res);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to create budget line.');
        return;
      }
    }

    setLineDialogOpen(false);
    resetLineForm();
    await refresh();
  };

  const toggleFormTag = (tagId: string) => {
    setFormTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // ---- Category CRUD ----

  const resetCatForm = () => {
    setCatFormName('');
    setEditingCatId(null);
    setCatFormError(null);
  };

  const handleEditCategory = (cat: BudgetCategory) => {
    setEditingCatId(cat.id);
    setCatFormName(cat.name);
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

  const handleCatSubmit = async () => {
    setCatFormError(null);
    if (!catFormName.trim()) {
      setCatFormError('Name is required.');
      return;
    }

    if (editingCatId) {
      setMutationError(null);
      const res = await fetch(`/api/budget-categories/${editingCatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catFormName.trim() }),
      });
      try {
        await ensureOk(res);
      } catch (error) {
        setCatFormError(error instanceof Error ? error.message : 'Failed to update category.');
        return;
      }
    } else {
      setMutationError(null);
      const res = await fetch('/api/budget-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catFormName.trim() }),
      });
      try {
        await ensureOk(res);
      } catch (error) {
        setCatFormError(error instanceof Error ? error.message : 'Failed to create category.');
        return;
      }
    }

    setCatDialogOpen(false);
    resetCatForm();
    await refresh();
  };

  // ---- Totals ----

  const totalBudget = summaryLines.reduce((s, l) => s + l.effectiveBudget, 0);
  const totalActual = summaryLines.reduce((s, l) => s + l.actualSpending, 0);
  const totalRemaining = totalBudget - totalActual;

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
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>

          {/* Add Category */}
          <Dialog
            open={catDialogOpen}
            onOpenChange={(open) => {
              setCatDialogOpen(open);
              if (!open) resetCatForm();
            }}
          >
            <DialogTrigger render={<Button variant="outline" />}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Add Category
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCatId ? 'Rename Category' : 'Create Category'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {catFormError && (
                  <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                    {catFormError}
                  </p>
                )}
                <div>
                  <Label>Name</Label>
                  <Input
                    value={catFormName}
                    onChange={(e) => {
                      setCatFormName(e.target.value);
                      setCatFormError(null);
                    }}
                    placeholder="e.g., Housing"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleCatSubmit();
                    }}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCatDialogOpen(false);
                      resetCatForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void handleCatSubmit()}>
                    {editingCatId ? 'Save' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Budget Line */}
          <Dialog
            open={lineDialogOpen}
            onOpenChange={(open) => {
              setLineDialogOpen(open);
              if (!open) resetLineForm();
            }}
          >
            <DialogTrigger render={<Button />}>
              <Plus className="mr-2 h-4 w-4" />
              Add Budget Line
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingLineId ? 'Edit Budget Line' : 'Create Budget Line'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {formError && (
                  <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                    {formError}
                  </p>
                )}
                <div>
                  <Label>Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="e.g., Groceries"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Period</Label>
                    <Select
                      value={formPeriod}
                      onValueChange={(v) => {
                        if (v !== null) setFormPeriod(v);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formAmount}
                      onChange={(e) => {
                        setFormAmount(e.target.value);
                        setFormError(null);
                      }}
                      placeholder="500.00"
                    />
                  </div>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formCategoryId ?? 'none'}
                    onValueChange={(v) => setFormCategoryId(v === 'none' ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {orderedCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rollover"
                    checked={formRollover}
                    onChange={(e) => setFormRollover(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="rollover">
                    Enable rollover (carry unspent/overspent to next period)
                  </Label>
                </div>
                <div>
                  <Label>Tags</Label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {tags.map((tag) => {
                      const isSelected = formTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleFormTag(tag.id)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-xs transition-colors',
                            isSelected ? 'border-current' : 'border-transparent opacity-50',
                          )}
                          style={{ color: tag.color, backgroundColor: `${tag.color}15` }}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setLineDialogOpen(false);
                      resetLineForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={() => void handleLineSubmit()}>
                    {editingLineId ? 'Update' : 'Create'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      {mutationError && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {mutationError}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                totalRemaining >= 0 ? 'text-green-600' : 'text-red-600',
              )}
            >
              {formatCurrency(totalRemaining)}
            </div>
          </CardContent>
        </Card>
      </div>

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
          <div className="text-right">Actual</div>
          <div className="text-right">Remaining</div>
          <div />
        </div>

        {loading ? (
          /* Loading skeleton */
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(ROW_GRID, 'border-b px-3 py-2 last:border-b-0')}>
              {Array.from({ length: 8 }).map((__, j) => (
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
                />
              ))}
            </SortableContext>

            {/* Uncategorized section — always at the bottom, not reorderable */}
            {(uncategorizedLines.length > 0 || allLineIds.length === 0) && (
              <UncategorizedSection
                lines={uncategorizedLines}
                onEditLine={handleEditLine}
                onDeleteLine={(id) => void handleDeleteLine(id)}
              />
            )}
          </DndContext>
        )}
      </div>
    </div>
  );
}
