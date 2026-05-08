'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TagBadge } from '@/components/tags/tag-badge';
import { buildTagTree, flattenTagTreeWithLevel } from '@/lib/tag-tree';
import { Tag, PRESET_COLORS } from '@/components/tags/constants';
import { findInTree, collectDescendantIds } from '@/components/tags/helpers';
import SortableSiblingList from '@/components/tags/tags-sortable-siblings-list';
import AutoTagRulesSection from '@/components/tags/tags-auto-tags-rules-section';

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3B82F6');
  // null = no parent (root level)
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formIsSource, setFormIsSource] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch('/api/tags');
      if (!res.ok) return;
      const data = await res.json();
      setTags(data);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      void fetchTags();
    }, 0);
    return () => clearTimeout(id);
  }, [fetchTags]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormColor('#3B82F6');
    setFormParentId(null);
    setFormIsSource(false);
    setEditingTag(null);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const handleEdit = useCallback((tag: Tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormParentId(tag.parentId);
    setFormIsSource(tag.isSource);
    setDialogOpen(true);
  }, []);

  /** Pre-fill the new-tag dialog with the given tag as parent */
  const handleAddChild = useCallback(
    (parentTag: Tag) => {
      resetForm();
      setFormParentId(parentTag.id);
      setFormIsSource(parentTag.isSource);
      setFormColor(parentTag.color);
      setDialogOpen(true);
    },
    [resetForm],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this tag? Child tags will be moved up to its parent.')) return;
      const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      if (res.ok) void fetchTags();
    },
    [fetchTags],
  );

  const handleSubmit = useCallback(async () => {
    if (!formName.trim()) return;
    setSaving(true);

    const payload = {
      name: formName.trim(),
      color: formColor,
      parentId: formParentId,
      isSource: formIsSource,
    };

    try {
      if (editingTag) {
        await fetch(`/api/tags/${editingTag.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchTags();
    } finally {
      setSaving(false);
    }
  }, [editingTag, fetchTags, formColor, formIsSource, formName, formParentId, resetForm]);

  /** Optimistically reorder siblings and persist to DB. */
  const handleReorder = useCallback(
    async (parentId: string | null, orderedIds: string[]) => {
      // Optimistic update: assign new order values to the reordered siblings
      setTags((prev) =>
        prev.map((tag) => {
          const newOrder = orderedIds.indexOf(tag.id);
          return newOrder !== -1 ? { ...tag, order: newOrder } : tag;
        }),
      );

      try {
        const res = await fetch('/api/tags/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentId,
            updates: orderedIds.map((id, idx) => ({ id, order: idx })),
          }),
        });

        if (!res.ok) {
          throw new Error('Failed to persist reorder');
        }
      } catch {
        // Re-fetch from DB to avoid stale rollback snapshots when drags overlap.
        await fetchTags();
      }
    },
    [fetchTags],
  );

  const categoryTags = tags.filter((t) => !t.isSource);
  const sourceTags = tags.filter((t) => t.isSource);
  const categoryTree = buildTagTree(categoryTags);
  const sourceTree = buildTagTree(sourceTags);
  const categoryTagsInDisplayOrder = flattenTagTreeWithLevel(categoryTree);

  // For the parent dropdown: exclude the tag being edited and all its descendants
  // (would create a cycle) and only show tags of the same isSource type.
  const allTree = buildTagTree(tags);
  const editingTagTree = editingTag ? findInTree(allTree, editingTag.id) : null;
  const excludedIds: Set<string> = editingTagTree
    ? new Set([editingTag!.id, ...collectDescendantIds(editingTagTree)])
    : editingTag
      ? new Set([editingTag.id])
      : new Set();

  const parentOptions = flattenTagTreeWithLevel(
    buildTagTree(tags.filter((t) => t.isSource === formIsSource)),
  ).filter((t) => !excludedIds.has(t.id));

  // Find the selected parent tag for display
  const selectedParentTag = formParentId ? tags.find((t) => t.id === formParentId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="border-primary border-l-[3px] pl-3">
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-muted-foreground text-sm">
            Organise your spending with nested category tags and source tags.
          </p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button onClick={openCreateDialog} />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Groceries"
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  autoFocus
                />
              </div>

              {/* Color */}
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: formColor === c ? 'white' : 'transparent',
                        boxShadow: formColor === c ? `0 0 0 2px ${c}` : undefined,
                      }}
                      onClick={() => setFormColor(c)}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span
                    className="h-5 w-5 flex-none rounded-full border"
                    style={{ backgroundColor: formColor }}
                  />
                  <Input
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="#3B82F6"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Type (isSource) */}
              {!editingTag && (
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select
                    value={formIsSource ? 'source' : 'category'}
                    onValueChange={(v) => {
                      setFormIsSource(v === 'source');
                      setFormParentId(null);
                    }}
                  >
                    <SelectTrigger>
                      <span className="text-sm capitalize">
                        {formIsSource ? 'Source' : 'Category'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="category">Category</SelectItem>
                      <SelectItem value="source">Source</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    {formIsSource
                      ? 'Source tags identify which account or card a transaction came from. They are excluded from budget calculations.'
                      : 'Category tags organise your spending. They are used in budget calculations.'}
                  </p>
                </div>
              )}

              {/* Parent tag */}
              <div className="space-y-1">
                <Label>Parent Tag</Label>
                <Select
                  value={formParentId ?? 'none'}
                  onValueChange={(v) => setFormParentId(v === 'none' ? null : v)}
                >
                  <SelectTrigger>
                    {selectedParentTag ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                          style={{ backgroundColor: selectedParentTag.color }}
                        />
                        {selectedParentTag.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">None (root level)</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (root level)</SelectItem>
                    {parentOptions.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span
                          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: t.color }}
                        />
                        <span style={{ marginLeft: `${t.level * 14}px` }}>{t.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedParentTag && (
                  <p className="text-muted-foreground text-xs">
                    Will be nested under{' '}
                    <TagBadge
                      name={selectedParentTag.name}
                      color={selectedParentTag.color}
                      className="text-xs"
                    />
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!formName.trim() || saving}>
                  {saving ? 'Saving…' : editingTag ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {/* Category Tags */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Category Tags</h2>
            <span className="text-muted-foreground text-sm">({categoryTags.length})</span>
          </div>
          {categoryTree.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No category tags yet.{' '}
              <button className="underline" onClick={openCreateDialog}>
                Create one
              </button>{' '}
              to get started.
            </p>
          ) : (
            <div className="rounded-md border">
              <SortableSiblingList
                tags={categoryTree}
                parentId={null}
                level={0}
                onEdit={handleEdit}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Source Tags */}
        <div>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">Source Tags</h2>
            <span className="text-muted-foreground text-sm">({sourceTags.length})</span>
          </div>
          {sourceTree.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No source tags yet. These identify which account or card a transaction came from (e.g.
              &ldquo;Chequing&rdquo;, &ldquo;Visa&rdquo;). They are excluded from budget
              calculations.
            </p>
          ) : (
            <div className="rounded-md border">
              <SortableSiblingList
                tags={sourceTree}
                parentId={null}
                level={0}
                onEdit={handleEdit}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Auto-Tag Rules */}
        <AutoTagRulesSection categoryTags={categoryTagsInDisplayOrder} />
      </div>
    </div>
  );
}
