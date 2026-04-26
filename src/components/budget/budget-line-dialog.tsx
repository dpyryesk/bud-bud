'use client';

import { useState, Fragment } from 'react';
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
import { cn } from '@/lib/utils';
import type { BudgetSummaryLine, BudgetCategory } from '@/types';
import type { TagOptionWithLevel } from './constants';

interface BudgetLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null → create mode; non-null → edit mode */
  editingLine: BudgetSummaryLine | null;
  categories: BudgetCategory[];
  tags: TagOptionWithLevel[];
  onSuccess: () => Promise<void>;
}

export function BudgetLineDialog({
  open,
  onOpenChange,
  editingLine,
  categories,
  tags,
  onSuccess,
}: BudgetLineDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Add Budget Line
      </DialogTrigger>
      {open && (
        <BudgetLineDialogContent
          key={editingLine?.budgetLine.id ?? 'new'}
          editingLine={editingLine}
          categories={categories}
          tags={tags}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function BudgetLineDialogContent({
  editingLine,
  categories,
  tags,
  onOpenChange,
  onSuccess,
}: Omit<BudgetLineDialogProps, 'open'>) {
  const [formName, setFormName] = useState(editingLine?.budgetLine.name ?? '');
  const [formPeriod, setFormPeriod] = useState(editingLine?.budgetLine.period ?? 'monthly');
  const [formAmount, setFormAmount] = useState(editingLine?.budgetLine.amount.toString() ?? '');
  const [formRollover, setFormRollover] = useState(editingLine?.budgetLine.rollover ?? false);
  const [formTagIds, setFormTagIds] = useState<string[]>(
    editingLine?.budgetLine.tags.map((t) => t.id) ?? [],
  );
  const [formCategoryId, setFormCategoryId] = useState<string | null>(
    editingLine?.budgetLine.categoryId ?? null,
  );
  const [formError, setFormError] = useState<string | null>(null);

  const toggleFormTag = (tagId: string) => {
    setFormTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  const handleSubmit = async () => {
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

    try {
      let res: Response;
      if (editingLine) {
        res = await fetch(`/api/budget-lines/${editingLine.budgetLine.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/budget-lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
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
        <DialogTitle>{editingLine ? 'Edit Budget Line' : 'Create Budget Line'}</DialogTitle>
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
              <SelectValue>
                {(value: string | null) =>
                  !value || value === 'none'
                    ? 'No category'
                    : (categories.find((c) => c.id === value)?.name ?? 'No category')
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No category</SelectItem>
              {categories.map((cat) => (
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
          <Label htmlFor="rollover">Enable rollover (carry unspent/overspent to next period)</Label>
        </div>
        <div>
          <Label>Tags</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag, index) => {
              const isSelected = formTagIds.includes(tag.id);
              const showDivider = tag.level === 0 && index !== 0;
              return (
                <Fragment key={tag.id}>
                  {showDivider && <div className="border-border my-1 w-full border-t" />}
                  <p>
                    <button
                      type="button"
                      onClick={() => toggleFormTag(tag.id)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs transition-colors',
                        isSelected ? 'border-current' : 'border-transparent opacity-50',
                      )}
                      style={{
                        color: tag.color,
                        backgroundColor: `${tag.color}15`,
                        ...(tag.level > 0 && { marginLeft: `${tag.level * 12}px` }),
                      }}
                    >
                      {tag.name}
                    </button>
                  </p>
                </Fragment>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>{editingLine ? 'Update' : 'Create'}</Button>
        </div>
      </div>
    </DialogContent>
  );
}
