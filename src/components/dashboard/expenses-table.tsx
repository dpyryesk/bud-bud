'use client';

import { Fragment, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';

interface ExpensesTableProps {
  summaryLines: BudgetSummaryLine[];
  orderedCategories: BudgetCategory[];
  totalYearlyNetIncome: number;
  onLineUpdated?: () => Promise<void>;
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  biweekly: 'Bi-weekly',
  yearly: 'Yearly',
};

function pct(value: number, total: number): string {
  if (total === 0) return '—';
  return `${((value / total) * 100).toFixed(1)}%`;
}

interface LineRowProps {
  line: BudgetSummaryLine;
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
  onLineUpdated?: () => Promise<void>;
}

function LineRow({ line, totalYearlyBudget, totalYearlyNetIncome, onLineUpdated }: LineRowProps) {
  const { budgetLine } = line;
  const [editingAmount, setEditingAmount] = useState(false);
  const [draftAmount, setDraftAmount] = useState(budgetLine.amount.toFixed(2));
  const [saving, setSaving] = useState(false);
  // Prevents duplicate PUT when Enter fires both onKeyDown and onBlur
  const commitInProgress = useRef(false);

  const yearlyAmount = getYearlyAmount(budgetLine.amount, budgetLine.period);

  const saveAmount = async () => {
    if (commitInProgress.current) return;
    commitInProgress.current = true;
    setEditingAmount(false);
    const parsed = parseFloat(draftAmount);
    if (isNaN(parsed) || parsed < 0 || parsed === budgetLine.amount) {
      setDraftAmount(budgetLine.amount.toFixed(2));
      commitInProgress.current = false;
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/budget-lines/${budgetLine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed }),
      });
      if (res.ok) await onLineUpdated?.();
    } finally {
      setSaving(false);
      commitInProgress.current = false;
    }
  };

  const savePeriod = async (newPeriod: string) => {
    if (newPeriod === budgetLine.period) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/budget-lines/${budgetLine.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: newPeriod }),
      });
      if (res.ok) await onLineUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className={cn('border-b text-sm last:border-0', saving && 'opacity-60')}>
      <td className="py-1.5 pr-4 pl-6">{budgetLine.name}</td>
      <td className="py-1.5 pr-2 text-right tabular-nums">
        {editingAmount ? (
          <Input
            type="number"
            step="0.01"
            min="0"
            value={draftAmount}
            onChange={(e) => setDraftAmount(e.target.value)}
            onBlur={() => void saveAmount()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void saveAmount();
              }
              if (e.key === 'Escape') {
                commitInProgress.current = true; // suppress onBlur save
                setDraftAmount(budgetLine.amount.toFixed(2));
                setEditingAmount(false);
                // reset after blur fires
                setTimeout(() => {
                  commitInProgress.current = false;
                }, 0);
              }
            }}
            autoFocus
            className="h-7 w-28 text-right text-sm"
          />
        ) : (
          <button
            type="button"
            title={`Edit base amount (${formatCurrency(budgetLine.amount)} per ${budgetLine.period})`}
            className={cn(
              'hover:bg-muted rounded px-1 text-right tabular-nums transition-colors',
              saving && 'pointer-events-none',
            )}
            onClick={() => {
              setDraftAmount(budgetLine.amount.toFixed(2));
              setEditingAmount(true);
            }}
          >
            {formatCurrency(budgetLine.amount)}
          </button>
        )}
      </td>
      <td className="py-1 pr-4">
        <Select
          value={budgetLine.period}
          onValueChange={(v) => {
            if (v !== null) void savePeriod(v);
          }}
          disabled={saving}
        >
          <SelectTrigger size="sm" className="w-28">
            <SelectValue>
              {(value: string | null) => PERIOD_LABEL[value ?? ''] ?? value ?? '—'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="biweekly">Bi-weekly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(yearlyAmount)}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">
        {pct(yearlyAmount, totalYearlyBudget)}
      </td>
      <td className="py-1.5 text-right tabular-nums">{pct(yearlyAmount, totalYearlyNetIncome)}</td>
    </tr>
  );
}

interface CategorySubtotalsProps {
  lines: BudgetSummaryLine[];
  totalYearlyBudget: number;
  totalYearlyNetIncome: number;
}

function CategorySubtotals({
  lines,
  totalYearlyBudget,
  totalYearlyNetIncome,
}: CategorySubtotalsProps) {
  const yearlyTotal = lines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );
  return (
    <tr className="bg-muted/20 text-sm font-medium">
      <td className="text-muted-foreground py-1.5 pr-4 pl-6 italic">Subtotal</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">
        {formatCurrency(lines.reduce((s, l) => s + l.scaledBudget, 0))}
      </td>
      <td className="py-1.5 pr-4" />
      <td className="py-1.5 pr-4 text-right tabular-nums">{formatCurrency(yearlyTotal)}</td>
      <td className="py-1.5 pr-4 text-right tabular-nums">{pct(yearlyTotal, totalYearlyBudget)}</td>
      <td className="py-1.5 text-right tabular-nums">{pct(yearlyTotal, totalYearlyNetIncome)}</td>
    </tr>
  );
}

export function ExpensesTable({
  summaryLines,
  orderedCategories,
  totalYearlyNetIncome,
  onLineUpdated,
}: ExpensesTableProps) {
  const totalYearlyBudget = summaryLines.reduce(
    (sum, l) => sum + getYearlyAmount(l.budgetLine.amount, l.budgetLine.period),
    0,
  );

  // Group lines by category
  const groupedLines: Record<string, BudgetSummaryLine[]> = {};
  for (const cat of orderedCategories) {
    groupedLines[cat.id] = summaryLines.filter((l) => l.budgetLine.categoryId === cat.id);
  }
  const uncategorizedLines = summaryLines.filter((l) => l.budgetLine.categoryId === null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        {summaryLines.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No budget lines configured. Set up your budget to see expenses here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="pr-4 pb-2 text-right font-medium">Amount</th>
                  <th className="pr-4 pb-2 font-medium">Period</th>
                  <th className="pr-4 pb-2 text-right font-medium">Yearly Total</th>
                  <th className="pr-4 pb-2 text-right font-medium">% of Budget</th>
                  <th className="pb-2 text-right font-medium">% of Income</th>
                </tr>
              </thead>
              <tbody>
                {orderedCategories.map((cat) => {
                  const lines = groupedLines[cat.id] ?? [];
                  if (lines.length === 0) return null;
                  return (
                    <Fragment key={cat.id}>
                      {/* Category header row */}
                      <tr className="bg-muted/40">
                        <td colSpan={6} className="px-3 py-1.5 text-sm font-semibold">
                          {cat.name}
                        </td>
                      </tr>
                      {lines.map((line) => (
                        <LineRow
                          key={line.budgetLine.id}
                          line={line}
                          totalYearlyBudget={totalYearlyBudget}
                          totalYearlyNetIncome={totalYearlyNetIncome}
                          onLineUpdated={onLineUpdated}
                        />
                      ))}
                      <CategorySubtotals
                        lines={lines}
                        totalYearlyBudget={totalYearlyBudget}
                        totalYearlyNetIncome={totalYearlyNetIncome}
                      />
                    </Fragment>
                  );
                })}

                {uncategorizedLines.length > 0 && (
                  <>
                    <tr className="bg-muted/40">
                      <td
                        colSpan={6}
                        className="text-muted-foreground px-3 py-1.5 text-sm font-semibold"
                      >
                        Uncategorized
                      </td>
                    </tr>
                    {uncategorizedLines.map((line) => (
                      <LineRow
                        key={line.budgetLine.id}
                        line={line}
                        totalYearlyBudget={totalYearlyBudget}
                        totalYearlyNetIncome={totalYearlyNetIncome}
                        onLineUpdated={onLineUpdated}
                      />
                    ))}
                    <CategorySubtotals
                      lines={uncategorizedLines}
                      totalYearlyBudget={totalYearlyBudget}
                      totalYearlyNetIncome={totalYearlyNetIncome}
                    />
                  </>
                )}

                {/* Grand total */}
                <tr className="border-t font-bold">
                  <td className="py-2 pr-4">Grand Total</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(summaryLines.reduce((s, l) => s + l.scaledBudget, 0))}
                  </td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatCurrency(totalYearlyBudget)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">100%</td>
                  <td className="py-2 text-right tabular-nums">
                    {pct(totalYearlyBudget, totalYearlyNetIncome)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
