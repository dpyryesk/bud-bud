'use client';

import { useEffect, useState, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import { IncomeSourceDialog } from './income-source-dialog';
import type { IncomeSource } from '@/types';

interface IncomeSourcesSectionProps {
  budgetId: string | null;
  totalYearlyBudget?: number;
  onRefresh?: () => void;
  onTotalYearlyNetChange?: (total: number) => void;
}

export function IncomeSourcesSection({
  budgetId,
  totalYearlyBudget,
  onRefresh,
  onTotalYearlyNetChange,
}: IncomeSourcesSectionProps) {
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<IncomeSource | null>(null);

  const fetchSources = useCallback(async () => {
    if (!budgetId) {
      setSources([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/income-sources?budgetId=${budgetId}`);
      if (res.ok) {
        setSources(await res.json());
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [budgetId]);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchSources();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchSources]);

  const handleSuccess = async () => {
    await fetchSources();
    onRefresh?.();
  };

  const handleEdit = (source: IncomeSource) => {
    setDeleteError(null);
    setEditingSource(source);
    setDialogOpen(true);
  };

  const handleDelete = async (source: IncomeSource) => {
    if (!window.confirm(`Delete income source "${source.name}"?`)) return;
    setDeleteError(null);
    try {
      const res = await fetch(`/api/income-sources/${source.id}`, { method: 'DELETE' });
      if (res.ok) {
        await handleSuccess();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error ?? `Delete failed (${res.status})`);
      }
    } catch {
      setDeleteError('Network error. Please try again.');
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) setEditingSource(null);
  };

  const totalYearlyNet = sources.reduce(
    (sum, s) => sum + getYearlyAmount(s.netAmount, s.netPeriod),
    0,
  );
  const totalYearlyGross = sources
    .filter((s) => s.grossAmount !== null)
    .reduce((sum, s) => sum + getYearlyAmount(s.grossAmount!, s.grossPeriod ?? s.netPeriod), 0);
  const hasGross = sources.some((s) => s.grossAmount !== null);

  useEffect(() => {
    onTotalYearlyNetChange?.(totalYearlyNet);
  }, [totalYearlyNet, onTotalYearlyNetChange]);

  const colCount = hasGross ? 8 : 5; // name + net + period + yearlyNet + [gross + period + yearlyGross] + actions
  const difference =
    totalYearlyBudget !== undefined ? totalYearlyNet - totalYearlyBudget : undefined;
  const isOverBudget = difference !== undefined && difference < 0;

  const periodLabel = (p: string) => {
    switch (p) {
      case 'monthly':
        return 'Monthly';
      case 'biweekly':
        return 'Bi-weekly';
      case 'yearly':
        return 'Yearly';
      default:
        return p;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Income Sources</CardTitle>
        <IncomeSourceDialog
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
          budgetId={budgetId}
          editingSource={editingSource}
          triggerDisabled={!budgetId}
          onSuccess={handleSuccess}
        />
      </CardHeader>
      <CardContent>
        {deleteError && (
          <p className="bg-destructive/10 text-destructive mb-3 rounded-md px-3 py-2 text-sm">
            {deleteError}
          </p>
        )}
        {loading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading income sources…">
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-4">
                <div className="bg-muted h-4 w-28 animate-pulse rounded" />
                <div className="bg-muted h-4 w-16 animate-pulse rounded" />
                <div className="bg-muted h-4 w-16 animate-pulse rounded" />
                <div className="bg-muted h-4 w-20 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : sources.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No income sources yet. Add one to track your expected income.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="pr-4 pb-2 font-medium">Net Amount</th>
                  <th className="pr-4 pb-2 font-medium">Net Period</th>
                  <th className="pr-4 pb-2 font-medium">Yearly Net</th>
                  {hasGross && (
                    <>
                      <th className="pr-4 pb-2 font-medium">Gross Amount</th>
                      <th className="pr-4 pb-2 font-medium">Gross Period</th>
                      <th className="pr-4 pb-2 font-medium">Yearly Gross</th>
                    </>
                  )}
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => (
                  <tr key={source.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{source.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatCurrency(source.netAmount)}</td>
                    <td className="py-2 pr-4">{periodLabel(source.netPeriod)}</td>
                    <td className="py-2 pr-4 font-medium tabular-nums">
                      {formatCurrency(getYearlyAmount(source.netAmount, source.netPeriod))}
                    </td>
                    {hasGross && (
                      <>
                        <td className="py-2 pr-4 tabular-nums">
                          {source.grossAmount !== null ? formatCurrency(source.grossAmount) : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {source.grossPeriod ? periodLabel(source.grossPeriod) : '—'}
                        </td>
                        <td className="py-2 pr-4 font-medium tabular-nums">
                          {source.grossAmount !== null
                            ? formatCurrency(
                                getYearlyAmount(
                                  source.grossAmount,
                                  source.grossPeriod ?? source.netPeriod,
                                ),
                              )
                            : '—'}
                        </td>
                      </>
                    )}
                    <td className="py-2">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(source)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-7 w-7"
                          onClick={() => void handleDelete(source)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4 tabular-nums">{formatCurrency(totalYearlyNet)}</td>
                  {hasGross && (
                    <>
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4 tabular-nums">{formatCurrency(totalYearlyGross)}</td>
                    </>
                  )}
                  <td className="py-2" />
                </tr>

                {/* Budget comparison rows — only shown when totalYearlyBudget is provided */}
                {totalYearlyBudget !== undefined && totalYearlyBudget > 0 && (
                  <>
                    <tr className="border-t font-semibold">
                      <td className="py-2 pr-4">Total Budget</td>
                      <td colSpan={colCount - 2} className="py-2 pr-4" />
                      <td className="py-2 pr-4 tabular-nums">
                        {formatCurrency(totalYearlyBudget)}
                      </td>
                    </tr>
                    <tr
                      className={cn(
                        'font-semibold',
                        isOverBudget ? 'text-destructive' : 'text-green-600 dark:text-green-400',
                      )}
                    >
                      <td className="py-2 pr-4">Difference (Income − Budget)</td>
                      <td colSpan={colCount - 2} className="py-2 pr-4" />
                      <td className="py-2 pr-4 tabular-nums">
                        {difference !== undefined
                          ? `${difference >= 0 ? '+' : ''}${formatCurrency(difference)}`
                          : '—'}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
