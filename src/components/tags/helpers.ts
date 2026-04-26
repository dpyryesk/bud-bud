import { TagTree } from '@/components/tags/constants';

// ---- Tree helpers ----
/** Recursively search all nodes in the tree for a specific id. */
export function findInTree(nodes: TagTree[], id: string): TagTree | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findInTree(node.childrenFull, id);
    if (found) return found;
  }
  return null;
}

/** Collect all descendant IDs (not including the node itself). */
export function collectDescendantIds(tag: TagTree): Set<string> {
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
