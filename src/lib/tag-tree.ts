export type TagLike = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
};

export type TagNode<T extends TagLike> = T & { data: T; childrenFull: TagNode<T>[] };
export type TagWithLevel<T extends TagLike> = T & { level: number };

export function buildTagTree<T extends TagLike>(tags: T[]): TagNode<T>[] {
  const nodeMap = new Map<string, TagNode<T>>();
  tags.forEach((tag) => nodeMap.set(tag.id, { ...tag, data: tag, childrenFull: [] }));

  const roots: TagNode<T>[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.childrenFull.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (nodes: TagNode<T>[]) => {
    nodes.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    nodes.forEach((child) => sortNodes(child.childrenFull));
  };

  sortNodes(roots);
  return roots;
}

export function flattenTagTreeWithLevel<T extends TagLike>(
  nodes: TagNode<T>[],
  level = 0,
): TagWithLevel<T>[] {
  const flattened: TagWithLevel<T>[] = [];

  const visit = (node: TagNode<T>, nodeLevel: number) => {
    flattened.push({ ...node.data, level: nodeLevel });
    node.childrenFull.forEach((child) => visit(child, nodeLevel + 1));
  };

  nodes.forEach((node) => visit(node, level));

  return flattened;
}

export function buildTagsInDisplayOrder<T extends TagLike>(tags: T[]): TagWithLevel<T>[] {
  return flattenTagTreeWithLevel(buildTagTree(tags));
}
