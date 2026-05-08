'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BudgetFormDialog, type BudgetFormMode } from '@/components/budgets/budget-form-dialog';
import { formatIsoDateForDisplay } from '@/lib/date-utils';
import type { BudgetWithMeta } from '@/types';

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<BudgetFormMode>('create');
  const [selectedBudget, setSelectedBudget] = useState<BudgetWithMeta | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    try {
      const res = await fetch('/api/budgets');
      if (!res.ok) return [];
      const data: BudgetWithMeta[] = await res.json();
      return data;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const data = await fetchBudgets();
      if (cancelled) return;
      setBudgets(data);
      setLoading(false);
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [fetchBudgets]);

  const reloadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBudgets();
      setBudgets(data);
    } finally {
      setLoading(false);
    }
  }, [fetchBudgets]);

  const handleCreate = useCallback(() => {
    setDialogMode('create');
    setSelectedBudget(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((budget: BudgetWithMeta) => {
    setDialogMode('edit');
    setSelectedBudget(budget);
    setDialogOpen(true);
  }, []);

  const handleCopy = useCallback((budget: BudgetWithMeta) => {
    setDialogMode('copy');
    setSelectedBudget(budget);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (budget: BudgetWithMeta) => {
      const label = formatIsoDateForDisplay(budget.startDate);
      if (!confirm(`Delete budget starting ${label}? This cannot be undone.`)) return;
      setDeleteError(null);
      try {
        const res = await fetch(`/api/budgets/${budget.id}`, { method: 'DELETE' });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          setDeleteError(data?.error ?? `Delete failed with status ${res.status}`);
          return;
        }
      } catch {
        setDeleteError('Network error. Please try again.');
        return;
      }
      await reloadBudgets();
    },
    [reloadBudgets],
  );

  const formatDate = (iso: string) => formatIsoDateForDisplay(iso);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="border-primary border-l-[3px] pl-3 text-2xl font-semibold">Budgets</h1>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      {deleteError && (
        <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
          {deleteError}
        </p>
      )}

      {loading ? (
        <div className="space-y-2" aria-busy="true" aria-label="Loading budgets…">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 rounded-md border px-4 py-3">
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted h-4 w-24 animate-pulse rounded" />
              <div className="bg-muted h-4 w-10 animate-pulse rounded" />
              <div className="bg-muted ml-auto h-4 w-40 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <p className="text-muted-foreground text-sm">No budgets yet. Create your first budget.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Start Date</TableHead>
              <TableHead>Valid Until</TableHead>
              <TableHead>Lines</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((budget) => (
              <TableRow key={budget.id}>
                <TableCell className="font-medium">{formatDate(budget.startDate)}</TableCell>
                <TableCell>
                  {budget.validUntil ? (
                    formatDate(budget.validUntil)
                  ) : (
                    <span className="text-muted-foreground italic">current</span>
                  )}
                </TableCell>
                <TableCell>{budget.lineCount}</TableCell>
                <TableCell>
                  {budget.resetRollover && <Badge variant="secondary">Resets rollover</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleCopy(budget)}>
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(budget)}>
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(budget)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <BudgetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        budget={selectedBudget}
        budgets={budgets}
        onSuccess={reloadBudgets}
      />
    </div>
  );
}
