'use client';

import { useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { BudgetCategory } from '@/types';

interface BudgetCategoryDialogProps {
  budgetId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerDisabled?: boolean;
  triggerTooltip?: string;
  /** null → create mode; non-null → edit mode */
  editingCategory: BudgetCategory | null;
  onSuccess: () => Promise<void>;
}

export function BudgetCategoryDialog({
  budgetId,
  open,
  onOpenChange,
  triggerDisabled = false,
  triggerTooltip = 'Create or activate a budget first',
  editingCategory,
  onSuccess,
}: BudgetCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    disabled={triggerDisabled}
                    aria-disabled={triggerDisabled}
                  />
                }
              />
            }
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Add Category
          </TooltipTrigger>
          {triggerDisabled && <TooltipContent>{triggerTooltip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
      {open && (
        <BudgetCategoryDialogContent
          key={editingCategory?.id ?? 'new'}
          budgetId={budgetId}
          editingCategory={editingCategory}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function BudgetCategoryDialogContent({
  budgetId,
  editingCategory,
  onOpenChange,
  onSuccess,
}: Omit<BudgetCategoryDialogProps, 'open'>) {
  const [catFormName, setCatFormName] = useState(editingCategory?.name ?? '');
  const [catFormError, setCatFormError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setCatFormError(null);
    if (!catFormName.trim()) {
      setCatFormError('Name is required.');
      return;
    }

    try {
      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/budget-categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catFormName.trim() }),
        });
      } else {
        if (!budgetId) {
          setCatFormError('No active budget selected.');
          return;
        }
        res = await fetch('/api/budget-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catFormName.trim(), budgetId }),
        });
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setCatFormError(data?.error ?? `Request failed with status ${res.status}`);
        return;
      }
    } catch {
      setCatFormError('Network error. Please try again.');
      return;
    }

    onOpenChange(false);
    await onSuccess();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editingCategory ? 'Rename Category' : 'Create Category'}</DialogTitle>
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
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>{editingCategory ? 'Save' : 'Create'}</Button>
        </div>
      </div>
    </DialogContent>
  );
}
