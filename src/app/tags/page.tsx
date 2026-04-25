'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  X,
  Zap,
} from 'lucide-react';
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
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { TagBadge } from '@/components/tags/tag-badge';
import { Badge } from '@/components/ui/badge';

// ---- Types ----

type Tag = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  children: { id: string }[];
};

type TagTree = Tag & { childrenFull: TagTree[] };

type AutoTagRule = {
  id: string;
  pattern: string;
  matchType: 'exact' | 'regex';
  tagId: string;
  tag: { id: string; name: string; color: string; isSource: boolean };
  createdAt: string;
};

// ---- Tree helpers ----

/** Build a recursive tree from a flat list. Orphaned tags (unknown parentId) become roots. */
function buildTree(tags: Tag[]): TagTree[] {
  const tagMap = new Map<string, TagTree>();
  tags.forEach((t) => tagMap.set(t.id, { ...t, childrenFull: [] }));

  const roots: TagTree[] = [];
  tagMap.forEach((t) => {
    if (t.parentId && tagMap.has(t.parentId)) {
      tagMap.get(t.parentId)!.childrenFull.push(t);
    } else {
      roots.push(t);
    }
  });

  const sortLevel = (nodes: TagTree[]): TagTree[] => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortLevel(n.childrenFull));
    return nodes;
  };

  return sortLevel(roots);
}

/** Recursively search all nodes in the tree for a specific id. */
function findInTree(nodes: TagTree[], id: string): TagTree | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findInTree(node.childrenFull, id);
    if (found) return found;
  }
  return null;
}

/** Collect all descendant IDs (not including the node itself). */
function collectDescendantIds(tag: TagTree): Set<string> {
  const ids = new Set<string>();
  const visit = (node: TagTree) => {
    node.childrenFull.forEach((child) => {
      ids.add(child.id);
      visit(child);
    });
  };
  visit(tag);
  return ids;
}

// ---- Constants ----

const PRESET_COLORS = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#8B5CF6',
  '#A855F7',
  '#D946EF',
  '#EC4899',
  '#F43F5E',
  '#6B7280',
  '#78716C',
];

// ---- Sub-components ----

function TagTreeNode({
  tag,
  onEdit,
  onAddChild,
  onDelete,
  level = 0,
}: {
  tag: TagTree;
  onEdit: (tag: Tag) => void;
  onAddChild: (parentTag: Tag) => void;
  onDelete: (id: string) => void;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = tag.childrenFull.length > 0;

  return (
    <div>
      <div
        className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <TagBadge name={tag.name} color={tag.color} isSource={tag.isSource} />

        {hasChildren && (
          <span className="text-muted-foreground text-xs">({tag.childrenFull.length})</span>
        )}

        <div className="flex-1" />

        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Add child tag"
            onClick={() => onAddChild(tag)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Edit tag"
            onClick={() => onEdit(tag)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            title="Delete tag"
            onClick={() => onDelete(tag.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded &&
        hasChildren &&
        tag.childrenFull.map((child) => (
          <TagTreeNode
            key={child.id}
            tag={child}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onDelete={onDelete}
            level={level + 1}
          />
        ))}
    </div>
  );
}

// ---- Auto-tag rules section ----

function AutoTagRulesSection({ categoryTags }: { categoryTags: Tag[] }) {
  const [rules, setRules] = useState<AutoTagRule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formPattern, setFormPattern] = useState('');
  const [formMatchType, setFormMatchType] = useState<'exact' | 'regex'>('exact');
  const [formTagId, setFormTagId] = useState('');
  const [saving, setSaving] = useState(false);
  const [regexError, setRegexError] = useState('');

  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/auto-tag/rules');
    const data = await res.json();
    setRules(data);
  }, []);

  useEffect(() => {
    fetch('/api/auto-tag/rules')
      .then((res) => res.json())
      .then((data) => setRules(data));
  }, []);

  const resetForm = useCallback(() => {
    setFormPattern('');
    setFormMatchType('exact');
    setFormTagId('');
    setRegexError('');
  }, []);

  const validateRegex = useCallback(
    (pattern: string) => {
      if (formMatchType !== 'regex') {
        setRegexError('');
        return true;
      }
      try {
        new RegExp(pattern);
        setRegexError('');
        return true;
      } catch {
        setRegexError('Invalid regular expression');
        return false;
      }
    },
    [formMatchType],
  );

  const handlePatternChange = useCallback(
    (value: string) => {
      setFormPattern(value);
      if (formMatchType === 'regex') validateRegex(value);
    },
    [formMatchType, validateRegex],
  );

  const handleMatchTypeChange = useCallback(
    (value: 'exact' | 'regex') => {
      setFormMatchType(value);
      setRegexError('');
      if (value === 'regex' && formPattern) {
        try {
          new RegExp(formPattern);
        } catch {
          setRegexError('Invalid regular expression');
        }
      }
    },
    [formPattern],
  );

  const handleCreate = useCallback(async () => {
    if (!formPattern.trim() || !formTagId) return;
    if (!validateRegex(formPattern)) return;

    setSaving(true);
    try {
      const res = await fetch('/api/auto-tag/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pattern: formPattern.trim(),
          matchType: formMatchType,
          tagId: formTagId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        setRegexError(err.error ?? 'Failed to create rule');
        return;
      }

      setDialogOpen(false);
      resetForm();
      await fetchRules();
    } finally {
      setSaving(false);
    }
  }, [fetchRules, formMatchType, formPattern, formTagId, resetForm, validateRegex]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this auto-tag rule?')) return;
      await fetch(`/api/auto-tag/rules/${id}`, { method: 'DELETE' });
      fetchRules();
    },
    [fetchRules],
  );

  const selectedTagForForm = categoryTags.find((t) => t.id === formTagId);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Zap className="text-muted-foreground h-4 w-4" />
        <h2 className="text-lg font-semibold">Auto-Tag Rules</h2>
        <span className="text-muted-foreground text-sm">({rules.length})</span>
        <div className="flex-1" />
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger render={<Button size="sm" onClick={() => setDialogOpen(true)} />}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Rule
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Auto-Tag Rule</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Match type */}
              <div className="space-y-1">
                <Label>Match Type</Label>
                <Select
                  value={formMatchType}
                  onValueChange={(v) => handleMatchTypeChange(v as 'exact' | 'regex')}
                >
                  <SelectTrigger>
                    <span className="text-sm capitalize">{formMatchType}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  {formMatchType === 'exact'
                    ? 'Match transactions whose normalized name is exactly this text (case-insensitive).'
                    : 'Match transactions whose normalized name matches this regular expression.'}
                </p>
              </div>

              {/* Pattern */}
              <div className="space-y-1">
                <Label htmlFor="rule-pattern">Pattern</Label>
                <Input
                  id="rule-pattern"
                  value={formPattern}
                  onChange={(e) => handlePatternChange(e.target.value)}
                  placeholder={
                    formMatchType === 'exact' ? 'e.g. uber eats' : 'e.g. uber\\s*eats'
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                  className={regexError ? 'border-destructive' : ''}
                />
                {regexError && <p className="text-destructive text-xs">{regexError}</p>}
                {formMatchType === 'exact' && (
                  <p className="text-muted-foreground text-xs">
                    Tip: the pattern is matched against the normalized name, which is lowercase with
                    long numbers stripped.
                  </p>
                )}
              </div>

              {/* Tag */}
              <div className="space-y-1">
                <Label>Apply Tag</Label>
                <Select value={formTagId} onValueChange={(v) => setFormTagId(v ?? '')}>
                  <SelectTrigger>
                    {selectedTagForForm ? (
                      <span className="flex items-center gap-1.5 text-sm">
                        <span
                          className="inline-block h-2.5 w-2.5 flex-none rounded-full"
                          style={{ backgroundColor: selectedTagForForm.color }}
                        />
                        {selectedTagForForm.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Select a tag…</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {categoryTags.length === 0 ? (
                      <div className="text-muted-foreground px-2 py-1.5 text-xs">
                        No category tags yet
                      </div>
                    ) : (
                      categoryTags
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
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
                <Button
                  onClick={handleCreate}
                  disabled={!formPattern.trim() || !formTagId || !!regexError || saving}
                >
                  {saving ? 'Saving…' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <p className="text-muted-foreground mb-3 text-sm">
        Rules are applied when you run auto-tagging. Each rule matches the transaction&apos;s
        normalized name and applies the associated tag.
      </p>

      {rules.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No rules yet.{' '}
          <button className="underline" onClick={() => setDialogOpen(true)}>
            Create one
          </button>{' '}
          to automatically tag transactions by name pattern.
        </p>
      ) : (
        <div className="rounded-md border">
          {rules.map((rule, idx) => (
            <div
              key={rule.id}
              className={`group flex items-center gap-3 px-3 py-2.5 ${idx < rules.length - 1 ? 'border-b' : ''}`}
            >
              {/* Match type badge */}
              <Badge
                variant="outline"
                className="shrink-0 font-mono text-xs uppercase tracking-wide"
              >
                {rule.matchType}
              </Badge>

              {/* Pattern */}
              <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-0.5 font-mono text-sm">
                {rule.pattern}
              </code>

              {/* Arrow */}
              <span className="text-muted-foreground shrink-0 text-xs">→</span>

              {/* Tag */}
              <div className="shrink-0">
                <TagBadge name={rule.tag.name} color={rule.tag.color} />
              </div>

              {/* Delete */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive opacity-0 group-hover:opacity-100"
                title="Delete rule"
                onClick={() => handleDelete(rule.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Page ----

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
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data);
  }, []);

  useEffect(() => {
    fetch('/api/tags')
      .then((res) => res.json()).then((data) => setTags(data));
  }, []);

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
      setDialogOpen(true);
    },
    [resetForm],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this tag? Child tags will be moved up to its parent.')) return;
      await fetch(`/api/tags/${id}`, { method: 'DELETE' });
      fetchTags();
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

  const categoryTags = tags.filter((t) => !t.isSource);
  const sourceTags = tags.filter((t) => t.isSource);
  const categoryTree = buildTree(categoryTags);
  const sourceTree = buildTree(sourceTags);

  // For the parent dropdown: exclude the tag being edited and all its descendants
  // (would create a cycle) and only show tags of the same isSource type.
  const allTree = buildTree(tags);
  const editingTagTree = editingTag ? findInTree(allTree, editingTag.id) : null;
  const excludedIds: Set<string> = editingTagTree
    ? new Set([editingTag!.id, ...collectDescendantIds(editingTagTree)])
    : editingTag
      ? new Set([editingTag.id])
      : new Set();

  const parentOptions = tags.filter(
    (t) => !excludedIds.has(t.id) && t.isSource === formIsSource,
  );

  // Find the selected parent tag for display
  const selectedParentTag = formParentId ? tags.find((t) => t.id === formParentId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
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

              {/* Color picker */}
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: formColor === c ? 'var(--foreground)' : 'transparent',
                        boxShadow: formColor === c ? '0 0 0 2px var(--background)' : 'none',
                      }}
                      title={c}
                      onClick={() => setFormColor(c)}
                      type="button"
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border"
                    title="Custom colour"
                  />
                  <span className="text-muted-foreground font-mono text-xs">{formColor}</span>
                  <TagBadge
                    name={formName || 'Preview'}
                    color={formColor}
                    isSource={formIsSource}
                  />
                </div>
              </div>

              {/* Source flag */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-source"
                  checked={formIsSource}
                  onChange={(e) => {
                    setFormIsSource(e.target.checked);
                    // Reset parent when toggling type to avoid type mismatch
                    setFormParentId(null);
                  }}
                  className="rounded"
                />
                <Label htmlFor="is-source" className="cursor-pointer font-normal">
                  Source tag{' '}
                  <span className="text-muted-foreground text-xs">
                    (account / card identifier, excluded from budget)
                  </span>
                </Label>
              </div>

              {/* Parent tag */}
              <div className="space-y-1">
                <Label>Parent Tag</Label>
                <div className="flex gap-2">
                  <Select
                    value={formParentId ?? ''}
                    onValueChange={(v) => setFormParentId(v || null)}
                  >
                    <SelectTrigger className="flex-1">
                      {/* Render the selected parent name manually.
                          base-ui Select.Value resolves ItemText lazily (only after
                          the popup has been opened), so pre-set values would show
                          the raw ID string. We bypass it with our own display. */}
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
                      {parentOptions.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-1.5 text-xs">
                          No available parent tags
                        </div>
                      ) : (
                        parentOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span
                              className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: t.color }}
                            />
                            {t.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {formParentId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      title="Clear parent"
                      onClick={() => setFormParentId(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
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
              {categoryTree.map((tag) => (
                <TagTreeNode
                  key={tag.id}
                  tag={tag}
                  onEdit={handleEdit}
                  onAddChild={handleAddChild}
                  onDelete={handleDelete}
                />
              ))}
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
              No source tags yet. These identify which account or card a transaction came from
              (e.g. &ldquo;Chequing&rdquo;, &ldquo;Visa&rdquo;). They are excluded from budget
              calculations.
            </p>
          ) : (
            <div className="rounded-md border">
              {sourceTree.map((tag) => (
                <TagTreeNode
                  key={tag.id}
                  tag={tag}
                  onEdit={handleEdit}
                  onAddChild={handleAddChild}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* Auto-Tag Rules */}
        <AutoTagRulesSection categoryTags={categoryTags} />
      </div>
    </div>
  );
}
