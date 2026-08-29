'use client';

import { useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TagBadge } from '@/components/tags/tag-badge';
import { TagSelectorDropdown } from '@/components/tags/tag-selector-dropdown';
import { cn } from '@/lib/utils';
import type { UntrackedCategoryWithSpending } from '@/types';
import type { TagOptionWithLevel } from '@/components/budget/constants';

interface UntrackedCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  editingCategory: UntrackedCategoryWithSpending | null;
  availableTags: TagOptionWithLevel[];
  onSuccess: () => Promise<void>;
}

export function UntrackedCategoryDialog({
  open,
  onOpenChange,
  year,
  editingCategory,
  availableTags,
  onSuccess,
}: UntrackedCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <UntrackedCategoryDialogContent
          key={editingCategory?.id ?? 'new'}
          year={year}
          editingCategory={editingCategory}
          availableTags={availableTags}
          onOpenChange={onOpenChange}
          onSuccess={onSuccess}
        />
      )}
    </Dialog>
  );
}

function UntrackedCategoryDialogContent({
  year,
  editingCategory,
  availableTags,
  onOpenChange,
  onSuccess,
}: Omit<UntrackedCategoryDialogProps, 'open'>) {
  const [formName, setFormName] = useState(editingCategory?.name ?? '');
  const [formTagIds, setFormTagIds] = useState<string[]>(
    editingCategory?.tags.map((t) => t.id) ?? [],
  );
  const [formError, setFormError] = useState<string | null>(null);

  const toggleTag = (tagId: string) => {
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

    try {
      let res: Response;
      if (editingCategory) {
        res = await fetch(`/api/untracked-categories/${editingCategory.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName.trim(), tagIds: formTagIds }),
        });
      } else {
        res = await fetch('/api/untracked-categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, name: formName.trim(), tagIds: formTagIds }),
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
        <DialogTitle>
          {editingCategory ? 'Edit Untracked Category' : 'Create Untracked Category'}
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
            placeholder="e.g., Entertainment"
          />
        </div>
        <div>
          <Label>Tags</Label>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {availableTags
              .filter((t) => formTagIds.includes(t.id))
              .map((tag) => (
                <TagBadge
                  key={tag.id}
                  name={tag.name}
                  color={tag.color}
                  onRemoveAction={() => toggleTag(tag.id)}
                  className="text-xs"
                />
              ))}
            <TagSelectorDropdown
              mode="multi"
              tags={availableTags}
              value={formTagIds}
              onToggle={toggleTag}
              triggerClassName={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'h-5 px-1.5')}
              triggerLabel="+"
              triggerAriaLabel="Add tag"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()}>
            {editingCategory ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
