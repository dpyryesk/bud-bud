import { type TagWithLevel } from '@/lib/tag-tree';

export type TagOption = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

export type TagOptionWithLevel = TagWithLevel<TagOption>;
