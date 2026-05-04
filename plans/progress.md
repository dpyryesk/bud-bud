[x] Create architecture plan document with all features
[x] Review plan with user and refine
[x] Initialize Next.js project with pnpm, TypeScript, Tailwind, ESLint, Prettier
[x] Set up Prisma with SQLite and define database schema
[x] Install and configure shadcn/ui components
[x] Build layout, navigation, and global time period selector with context
[x] Build tag management — CRUD API + tree UI + color picker + source tag support
[x] Tag drag-and-drop reordering — `order` field in DB, PATCH /api/tags/reorder endpoint, @dnd-kit sortable handles per sibling group, optimistic UI updates, order preserved in all dropdowns
[x] Build CSV import — mapping config, parser, duplicate detection, source tag assignment, preview
[x] Build auto-tagging — engine, rule management, exact-match lookup, regex matching
[x] Build transactions view — table, period filtering, tag assignment, notes, auto-tag button
[x] Build budget line management — CRUD API + form UI
[x] Build budget view — calculations with scaling, rollup, split, rollover + display
[x] Add categories to the budget view — budget lines grouped by category, subtotals for each category, drag-and-drop reordering of categories and budget lines
[x] Build dashboard + charts with recharts
[x] Polish — error handling, loading states, responsive design, edge cases
[ ] Add advanced filtering to the transactions view
[ ] Handle bi-weekly periods (there can be two or three per month)
