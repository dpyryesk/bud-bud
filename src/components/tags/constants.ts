import { TagNode, TagWithLevel } from '@/lib/tag-tree';

// ---- Types ----
export type Tag = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
  children: { id: string }[];
};

export type TagTree = TagNode<Tag>;
export type LeveledTag = TagWithLevel<Tag>;

export type AutoTagRule = {
  id: string;
  pattern: string;
  matchType: 'exact' | 'regex';
  tagId: string;
  tag: { id: string; name: string; color: string; isSource: boolean };
  createdAt: string;
};

// ---- Constants ----

export const PRESET_COLORS = [
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
