'use client';

import { useState } from 'react';
import { InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatIsoDateForDisplay } from '@/lib/date-utils';
import type { BudgetWithMeta } from '@/types';

export type BudgetFormMode = 'create' | 'edit' | 'copy';

const COPY_FROM_NONE = 'none';

const RESET_ROLLOVER_TOOLTIP =
  'When checked, all budget line rollovers start at zero from this budget\u2019s start date, ' +
  'ignoring previous budgets. When unchecked, rollover is carried forward from the prior budget chain.';

interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Determines the API call: create → POST, edit → PUT, copy → POST copy */
  mode: BudgetFormMode;
  /** null for create mode; required for edit/copy */
  budget: BudgetWithMeta | null;
  /** Full list of budgets — used to populate the "Copy from" dropdown in create mode */
  budgets: BudgetWithMeta[];
  onSuccess: () => Promise<void>;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  mode,
  budget,
  budgets,
  onSuccess,
}: BudgetFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <BudgetFormDialogContent
          key={`${mode}-${budget?.id ?? 'new'}`}
          mode={mode}
          budget={budget}
          budgets={budgets}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function BudgetFormDialogContent({
  mode,
  budget,
  budgets,
  onOpenChange,
  onSuccess,
}: Omit<BudgetFormDialogProps, 'open'>) {
  // Edit mode pre-fills the existing date; copy mode leaves it blank (new date needed)
  const initialDate = mode === 'edit' && budget ? budget.startDate.slice(0, 10) : '';
  const [startDate, setStartDate] = useState(initialDate);
  const [resetRollover, setResetRollover] = useState(budget?.resetRollover ?? false);
  // copyFrom is only used in create mode; COPY_FROM_NONE means "blank budget"
  const [copyFrom, setCopyFrom] = useState<string>(COPY_FROM_NONE);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const formatBudgetDate = (iso: string) => formatIsoDateForDisplay(iso);

  const titles: Record<BudgetFormMode, string> = {
    create: 'New Budget',
    edit: 'Edit Budget',
    copy: 'Copy Budget',
  };

  const handleSubmit = async () => {
    setError(null);
    if (!startDate) {
      setError('Start date is required.');
      return;
    }

    setSaving(true);
    try {
      let res: Response;
      if (mode === 'create') {
        if (copyFrom && copyFrom !== COPY_FROM_NONE) {
          // Copy an existing budget's structure to the new start date
          res = await fetch(`/api/budgets/${copyFrom}/copy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, resetRollover }),
          });
        } else {
          // Create a fresh blank budget
          res = await fetch('/api/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, resetRollover }),
          });
        }
      } else if (mode === 'edit' && budget) {
        res = await fetch(`/api/budgets/${budget.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, resetRollover }),
        });
      } else if (mode === 'copy' && budget) {
        res = await fetch(`/api/budgets/${budget.id}/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startDate, resetRollover }),
        });
      } else {
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `Request failed with status ${res.status}`);
        return;
      }
    } catch {
      setError('Network error. Please try again.');
      return;
    } finally {
      setSaving(false);
    }

    onOpenChange(false);
    await onSuccess();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{titles[mode]}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {error && (
          <p className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">{error}</p>
        )}

        {/* copyFrom — only shown in create mode */}
        {mode === 'create' && (
          <div className="space-y-1.5">
            <Label htmlFor="budget-copy-from">Copy from (optional)</Label>
            <Select value={copyFrom} onValueChange={(v) => setCopyFrom(v ?? COPY_FROM_NONE)}>
              <SelectTrigger id="budget-copy-from" className="w-full">
                <SelectValue>
                  {(value: string | null) =>
                    !value || value === COPY_FROM_NONE
                      ? 'None (blank budget)'
                      : (() => {
                          const b = budgets.find((b) => b.id === value);
                          return b ? formatBudgetDate(b.startDate) : 'Unknown';
                        })()
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={COPY_FROM_NONE}>None (blank budget)</SelectItem>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {formatBudgetDate(b.startDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* startDate */}
        <div className="space-y-1.5">
          <Label htmlFor="budget-start-date">Start Date</Label>
          <Input
            id="budget-start-date"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
        </div>

        {/* resetRollover */}
        <div className="flex items-center gap-2">
          <input
            id="budget-reset-rollover"
            type="checkbox"
            checked={resetRollover}
            onChange={(e) => setResetRollover(e.target.checked)}
            className="h-4 w-4 cursor-pointer"
          />
          <Label htmlFor="budget-reset-rollover" className="cursor-pointer font-normal">
            Reset rollover at this budget&apos;s start date
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="inline-flex cursor-help items-center">
                <InfoIcon className="text-muted-foreground h-4 w-4 shrink-0" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {RESET_ROLLOVER_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {mode === 'create' ? 'Create' : mode === 'copy' ? 'Copy' : 'Save'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
