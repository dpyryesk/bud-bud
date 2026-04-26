'use client';

import { Tag, TagTree } from '@/components/tags/constants';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableTagRow from '@/components/tags/tags-sortable-tag-row';

export default function SortableSiblingList({
  tags,
  parentId,
  level,
  onEdit,
  onAddChild,
  onDelete,
  onReorder,
}: {
  tags: TagTree[];
  parentId: string | null;
  level: number;
  onEdit: (tag: Tag) => void;
  onAddChild: (parentTag: Tag) => void;
  onDelete: (id: string) => void;
  onReorder: (parentId: string | null, orderedIds: string[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tags.findIndex((t) => t.id === active.id);
    const newIndex = tags.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tags, oldIndex, newIndex);
    onReorder(
      parentId,
      reordered.map((t) => t.id),
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tags.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        {tags.map((tag) => (
          <SortableTagRow
            key={tag.id}
            tag={tag}
            level={level}
            onEdit={onEdit}
            onAddChild={onAddChild}
            onDelete={onDelete}
            onReorder={onReorder}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
