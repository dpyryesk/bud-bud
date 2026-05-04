'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import type { IncomeSource, BudgetPeriodType } from '@/types';

interface IncomeSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string | null;
  editingSource: IncomeSource | null;
  triggerDisabled?: boolean;
  onSuccess: () => Promise<void>;
}

export function IncomeSourceDialog({
  open,
  onOpenChange,
  budgetId,
  editingSource,
  triggerDisabled = false,
  onSuccess,
}: IncomeSourceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button disabled={triggerDisabled} aria-disabled={triggerDisabled} />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Income Source
      </DialogTrigger>
      {open && (
        <IncomeSourceDialogContent
          key={editingSource?.id ?? 'new'}
          budgetId={budgetId}
          editingSource={editingSource}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function IncomeSourceDialogContent({
  budgetId,
  editingSource,
  onOpenChange,
  onSuccess,
}: Omit<IncomeSourceDialogProps, 'open'>) {
  const [formName, setFormName] = useState(editingSource?.name ?? '');
  const [formNetAmount, setFormNetAmount] = useState(editingSource?.netAmount.toString() ?? '');
  const [formNetPeriod, setFormNetPeriod] = useState<BudgetPeriodType>(
    editingSource?.netPeriod ?? 'monthly',
  );
  const [formGrossAmount, setFormGrossAmount] = useState(
    editingSource?.grossAmount?.toString() ?? '',
  );
  const [formGrossPeriod, setFormGrossPeriod] = useState<BudgetPeriodType>(
    editingSource?.grossPeriod ?? 'monthly',
  );
  const [formError, setFormError] = useState<string | null>(null);

  const parsedNetAmount = parseFloat(formNetAmount);
  const parsedGrossAmount = formGrossAmount ? parseFloat(formGrossAmount) : null;

  const yearlyNet = !isNaN(parsedNetAmount)
    ? getYearlyAmount(parsedNetAmount, formNetPeriod)
    : null;
  const yearlyGross =
    parsedGrossAmount !== null && !isNaN(parsedGrossAmount)
      ? getYearlyAmount(parsedGrossAmount, formGrossPeriod)
      : null;

  const handleSubmit = async () => {
    setFormError(null);
    if (!formName.trim()) {
      setFormError('Name is required.');
      return;
    }
    if (!formNetAmount || isNaN(parsedNetAmount) || parsedNetAmount < 0) {
      setFormError('Net amount must be a valid non-negative number.');
      return;
    }

    const payload = {
      name: formName.trim(),
      netAmount: parsedNetAmount,
      netPeriod: formNetPeriod,
      grossAmount:
        parsedGrossAmount !== null && !isNaN(parsedGrossAmount) ? parsedGrossAmount : null,
      grossPeriod: parsedGrossAmount !== null && !isNaN(parsedGrossAmount) ? formGrossPeriod : null,
    };

    try {
      let res: Response;
      if (editingSource) {
        res = await fetch(`/api/income-sources/${editingSource.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        if (!budgetId) {
          setFormError('No active budget selected.');
          return;
        }
        res = await fetch('/api/income-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, budgetId }),
        });
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(data?.error ?? `Request failed with status ${res.status}`);
        return;
      }
    } catch {
      setFormError('Network error. Please try again.');
      return;
    }

    onOpenChange(false);
    await onSuccess();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editingSource ? 'Edit Income Source' : 'Add Income Source'}</DialogTitle>
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
            placeholder="e.g., Salary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Net Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formNetAmount}
              onChange={(e) => {
                setFormNetAmount(e.target.value);
                setFormError(null);
              }}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label>Net Period</Label>
            <Select
              value={formNetPeriod}
              onValueChange={(v) => {
                if (v) setFormNetPeriod(v as BudgetPeriodType);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Gross Amount (optional)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formGrossAmount}
              onChange={(e) => {
                setFormGrossAmount(e.target.value);
                setFormError(null);
              }}
              placeholder="0.00"
            />
          </div>
          {formGrossAmount && (
            <div>
              <Label>Gross Period</Label>
              <Select
                value={formGrossPeriod}
                onValueChange={(v) => {
                  if (v) setFormGrossPeriod(v as BudgetPeriodType);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Yearly previews */}
        <div className="bg-muted/50 space-y-1 rounded-md px-3 py-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Yearly Net</span>
            <span className="font-medium">
              {yearlyNet !== null ? formatCurrency(yearlyNet) : '—'}
            </span>
          </div>
          {yearlyGross !== null && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Yearly Gross</span>
              <span className="font-medium">{formatCurrency(yearlyGross)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>{editingSource ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </DialogContent>
  );
}
