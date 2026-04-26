import type { TagWithLevel } from '@/lib/tag-tree';

// ---- Shared type for tag options ----
export type TagOption = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

export type TagOptionWithLevel = TagWithLevel<TagOption>;

// ---- Grid layout shared by header, category, and line rows ----
export const ROW_GRID =
  'grid grid-cols-[2rem_minmax(8rem,1fr)_minmax(8rem,1fr)_5rem_7rem_7rem_7rem_5rem] items-center gap-x-3';
