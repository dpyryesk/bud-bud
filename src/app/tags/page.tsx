'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, ChevronDown } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { TagBadge } from '@/components/tags/tag-badge';

type Tag = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  children: { id: string }[];
};

type TagTree = Tag & { childrenFull: TagTree[] };

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

  return roots;
}

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  '#6B7280', '#78716C',
];

function TagTreeNode({
  tag,
  allTags,
  onEdit,
  onDelete,
  level = 0,
}: {
  tag: TagTree;
  allTags: Tag[];
  onEdit: (tag: Tag) => void;
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
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <TagBadge name={tag.name} color={tag.color} isSource={tag.isSource} />
        <div className="flex-1" />
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(tag)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
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
            allTags={allTags}
            onEdit={onEdit}
            onDelete={onDelete}
            level={level + 1}
          />
        ))}
    </div>
  );
}

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('#3B82F6');
  const [formParentId, setFormParentId] = useState<string>('');
  const [formIsSource, setFormIsSource] = useState(false);

  const fetchTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const data = await res.json();
    setTags(data);
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const resetForm = () => {
    setFormName('');
    setFormColor('#3B82F6');
    setFormParentId('');
    setFormIsSource(false);
    setEditingTag(null);
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color);
    setFormParentId(tag.parentId || '');
    setFormIsSource(tag.isSource);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag? Children will be moved to the parent.')) return;
    await fetch(`/api/tags/${id}`, { method: 'DELETE' });
    fetchTags();
  };

  const handleSubmit = async () => {
    const payload = {
      name: formName,
      color: formColor,
      parentId: formParentId || null,
      isSource: formIsSource,
    };

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
    fetchTags();
  };

  const categoryTags = tags.filter((t) => !t.isSource);
  const sourceTags = tags.filter((t) => t.isSource);
  const categoryTree = buildTree(categoryTags);
  const sourceTree = buildTree(sourceTags);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tags</h1>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger render={<Button />}>
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tag-name">Name</Label>
                <Input
                  id="tag-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Groceries"
                />
              </div>

              <div>
                <Label>Color</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: formColor === c ? '#000' : 'transparent',
                      }}
                      onClick={() => setFormColor(c)}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="mt-2 h-8 w-20"
                />
              </div>

              <div>
                <Label>Parent Tag</Label>
                <Select value={formParentId} onValueChange={(v) => { if (v !== null) setFormParentId(v); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="None (root level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (root level)</SelectItem>
                    {tags
                      .filter((t) => t.id !== editingTag?.id && t.isSource === formIsSource)
                      .map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is-source"
                  checked={formIsSource}
                  onChange={(e) => setFormIsSource(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="is-source">Source tag (account/card identifier)</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={!formName.trim()}>
                  {editingTag ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Category Tags</h2>
          {categoryTree.length === 0 ? (
            <p className="text-muted-foreground text-sm">No category tags yet. Create one to get started.</p>
          ) : (
            <div className="rounded-md border">
              {categoryTree.map((tag) => (
                <TagTreeNode
                  key={tag.id}
                  tag={tag}
                  allTags={tags}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        <Separator />

        <div>
          <h2 className="mb-2 text-lg font-semibold">Source Tags</h2>
          {sourceTree.length === 0 ? (
            <p className="text-muted-foreground text-sm">No source tags yet. These identify which account/card a transaction came from.</p>
          ) : (
            <div className="rounded-md border">
              {sourceTree.map((tag) => (
                <TagTreeNode
                  key={tag.id}
                  tag={tag}
                  allTags={tags}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
