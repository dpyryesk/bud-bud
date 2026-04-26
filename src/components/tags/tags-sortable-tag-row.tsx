'use client';

import { useState } from 'react';
import { Pencil, Trash2, ChevronRight, ChevronDown, FolderPlus, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { TagBadge } from '@/components/tags/tag-badge';
import { Tag, TagTree } from '@/components/tags/constants';
import SortableSiblingList from '@/components/tags/tags-sortable-siblings-list';

export default function SortableTagRow({
  tag,
  level,
  onEdit,
  onAddChild,
  onDelete,
  onReorder,
}: {
  tag: TagTree;
  level: number;
  onEdit: (tag: Tag) => void;
  onAddChild: (parentTag: Tag) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, orderedIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = tag.childrenFull.length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tag.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className="group hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {/* Drag handle */}
        <button
          className="text-muted-foreground cursor-grab touch-none opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            className="text-destructive h-7 w-7"
            title="Delete tag"
            onClick={() => onDelete(tag.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {expanded && hasChildren && (
        <SortableSiblingList
          tags={tag.childrenFull}
          parentId={tag.id}
          level={level + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      )}
    </div>
  );
}
