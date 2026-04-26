<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:select-dropdown-rules -->

## Select / Dropdown — always use children-as-function for controlled label display

The project uses `@base-ui/react/select` via the wrapper in `src/components/ui/select.tsx`.

**Problem**: `Select.Value` resolves the display label by looking up registered items in its internal store. Items register when `SelectContent` (the popup) first mounts. On a controlled `<Select value={...}>` that opens inside a Dialog (or any lazy-mount container), the popup has never opened yet, so the store contains no items — and `Select.Value` falls back to rendering the raw `value` string (e.g. a UUID).

**Rule**: Whenever the `Select` value is an opaque key (UUID, enum, etc.) that is not human-readable on its own, **always** pass a render function as `children` to `SelectValue` so the label is resolved explicitly:

```tsx
<SelectValue>
  {(value: string | null) =>
    !value || value === 'none'
      ? 'No selection'
      : (myOptions.find((o) => o.id === value)?.name ?? 'Unknown')
  }
</SelectValue>
```

- The `children` prop accepts `React.ReactNode | ((value: any) => React.ReactNode)`.
- When `children` is a function it completely overrides the internal item-lookup path — the label is always correct regardless of whether the popup has ever opened.
- Do **not** rely on `placeholder` when using the function form; return the placeholder text from the function for the empty/null case.

<!-- END:select-dropdown-rules -->

<!-- BEGIN:tag-sorting-rules -->

## Tags — always sort using buildTagsInDisplayOrder

Tags are hierarchical (parent → children) and have an explicit `order` field for siblings.

**Rule**: Whenever displaying a list of tags (selectable pills, dropdown items, etc.) always sort them with `buildTagsInDisplayOrder` from `src/lib/tag-tree.ts` **before** storing in state or rendering.

```ts
import { buildTagsInDisplayOrder, type TagWithLevel } from '@/lib/tag-tree';

// TagOption must include parentId and order for the tree builder to work
type TagOption = {
  id: string;
  name: string;
  color: string;
  isSource: boolean;
  parentId: string | null;
  order: number;
};

const fetchTags = async () => {
  const data = await fetch('/api/tags').then((r) => r.json());
  const categoryTags = data.filter((t: TagOption) => !t.isSource);
  setTags(buildTagsInDisplayOrder(categoryTags)); // TagWithLevel<TagOption>[]
};
```

- `buildTagsInDisplayOrder` performs a depth-first traversal: root tags (by `order`) followed immediately by their children (by `order`), recursively.
- The returned items have a `level: number` property (0 = root, 1 = first child, etc.) that can be used for visual indentation.
- **Never** display the raw API response order — the API returns a flat list ordered only by the top-level `order` column, which does not preserve hierarchy.

<!-- END:tag-sorting-rules -->

<!-- BEGIN:component-decomposition-rules -->

## Component decomposition — keep files focused, extract reusable pieces

**Rule**: Page files (and any other source file) should stay focused on orchestration. When a file grows large, extract self-contained UI or logic into purpose-specific components.

### When to extract

- Any named function component that is not the default page export (`SortableLineRow`, `SortableCategorySection`, dialog forms, summary cards, etc.) should live in its own file under `src/components/<feature>/`.
- Any constant or type shared by more than one component (e.g. a grid layout class string, a domain-specific option type) belongs in a `constants.ts` (or similar) file in the same feature folder.
- Dialog / form components should own their **internal form state** and accept only the minimal props needed (`open`, `onOpenChange`, editing target, data lists, `onSuccess`). This keeps the parent page free of per-field state variables.

### Target file sizes

| Kind                   | Soft limit  |
| ---------------------- | ----------- |
| Page / route component | ≤ 350 lines |
| Feature component      | ≤ 250 lines |
| UI primitive / utility | ≤ 150 lines |

Exceeding a limit is a signal to decompose further, not a hard error.

### Where components live

```
src/components/<feature>/        ← feature-specific components
  constants.ts                   ← shared constants & types for the feature
  sortable-line-row.tsx
  sortable-category-section.tsx
  budget-line-dialog.tsx
  …

src/components/ui/               ← generic, project-wide UI primitives
src/components/layout/           ← layout shells (sidebar, header, …)
```

<!-- END:component-decomposition-rules -->
