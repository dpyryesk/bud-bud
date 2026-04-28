# Multi-Budget Feature — Implementation Tasks

Reference: [multi-budget-plan.md](./multi-budget-plan.md)

---

## Task List

### 1 — Prisma Schema

- [x] Add `Budget` model to [`prisma/schema.prisma`](../prisma/schema.prisma):
  - Fields: `id String @id @default(cuid())`, `startDate DateTime`, `resetRollover Boolean @default(false)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`
  - Relations: `categories BudgetCategory[]`, `lines BudgetLine[]`
- [x] Add `budgetId String` + `budget Budget @relation(...)` + `onDelete: Cascade` to `BudgetCategory`
- [x] Add `budgetId String` + `budget Budget @relation(...)` + `onDelete: Cascade` to `BudgetLine`

---

### 2 — Database Migration

- [x] Run `prisma migrate dev --create-only` to generate a new migration file
- [x] Edit the generated SQL to add (before the NOT NULL constraint on budgetId):

  ```sql
  INSERT INTO Budget (id, startDate, resetRollover, createdAt, updatedAt)
  VALUES ('default-budget-seed', '2000-01-01 00:00:00.000', 0, datetime('now'), datetime('now'));

  UPDATE BudgetCategory SET budgetId = 'default-budget-seed' WHERE budgetId IS NULL;
  UPDATE BudgetLine SET budgetId = 'default-budget-seed' WHERE budgetId IS NULL;
  ```

- [x] Run `prisma migrate dev` to apply the migration and regenerate the Prisma client

---

### 3 — Types (`src/types/index.ts`)

- [x] Add `Budget` type: `{ id, startDate, resetRollover, createdAt, updatedAt }` (all strings/boolean)
- [x] Add `BudgetWithMeta` type: extends `Budget` with `{ categoryCount: number; lineCount: number; validUntil: string | null }`
- [x] Change `BudgetSummaryLine[]` response to `BudgetSummaryResponse = { activeBudget: Budget | null; lines: BudgetSummaryLine[] }`

---

### 4 — `GET /api/budgets` and `POST /api/budgets`

**File:** `src/app/api/budgets/route.ts` (new)

- [x] `GET` — fetch all budgets ordered by `startDate` asc; compute `validUntil` (next budget's startDate or null); include `_count: { categories, lines }`; return as `BudgetWithMeta[]`
- [x] `POST` — accept `{ startDate, resetRollover? }`, validate startDate, reject if a budget with the same startDate already exists, create and return the new budget

---

### 5 — `GET /PUT /DELETE /api/budgets/[id]`

**File:** `src/app/api/budgets/[id]/route.ts` (new)

- [x] `GET` — return single budget by id (404 if not found)
- [x] `PUT` — accept `{ startDate?, resetRollover? }`, validate no duplicate startDate on update, update and return
- [x] `DELETE` — delete budget (cascades to categories and lines); block delete if it is the only budget

---

### 6 — `POST /api/budgets/[id]/copy`

**File:** `src/app/api/budgets/[id]/copy/route.ts` (new)

- [x] Accept `{ startDate, resetRollover? }`
- [x] Fetch source budget with all categories and lines (include `BudgetLineTag`)
- [x] In a `prisma.$transaction`:
  1. Create new `Budget`
  2. For each source category → create new `BudgetCategory` (new `budgetId`); store old→new id map
  3. For each source line → create new `BudgetLine` (new `budgetId`, mapped `categoryId`)
  4. For each source line's `BudgetLineTag` → create new records pointing to new line IDs
- [x] Return new budget (with counts)

---

### 7 — Update `/api/budget-categories`

**Files:** `src/app/api/budget-categories/route.ts`, `src/app/api/budget-categories/[id]/route.ts`

- [x] `GET` — require `budgetId` query param; filter `findMany` by `budgetId`; return 400 if missing
- [x] `POST` — require `budgetId` in body; validate budget exists; include in `create` data

---

### 8 — Update `/api/budget-lines`

**Files:** `src/app/api/budget-lines/route.ts`, `src/app/api/budget-lines/[id]/route.ts`

- [x] `GET` — require `budgetId` query param; filter `findMany` by `budgetId`; return 400 if missing
- [x] `POST` — require `budgetId` in body; validate budget exists; include in `create` data
- [x] `PUT [id]` — no change to budgetId on update (lines don't move between budgets)

---

### 9 — Update `GET /api/budget/summary`

**File:** `src/app/api/budget/summary/route.ts`

- [x] Load all budgets (sorted by startDate asc) at the start
- [x] Implement `findApplicableBudget(budgets, date)` — latest budget where `startDate <= date`; fallback to earliest
- [x] Implement `findRolloverHistoryStart(budget, allBudgets)` — recursive chain traversal via `resetRollover`
- [x] Filter `budgetLine.findMany` to `{ budgetId: applicableBudget.id }`
- [x] Replace `earliestTx.date`-based rollover start with `findRolloverHistoryStart` result
- [x] Change response shape to `{ activeBudget: Budget, lines: BudgetSummaryLine[] }`

---

### 10 — Update `GET /api/budget/untracked`

**File:** `src/app/api/budget/untracked/route.ts`

- [x] Load all budgets; find applicable budget for the `start` date
- [x] Filter `budgetLine.findMany` to `{ budgetId: applicableBudget.id }`
- [x] If no budgets exist, return empty (no crash)

---

### 11 — Sidebar Navigation

**File:** `src/components/layout/sidebar.tsx`

- [x] Add a "Budgets" nav item (with suitable icon, e.g. `CalendarRange`) linking to `/budgets`, near the "Budget" item

---

### 12 — `/budgets` Page

**File:** `src/app/budgets/page.tsx` (new)

- [x] Fetch `GET /api/budgets` on mount
- [x] Render a table/list: each row shows formatted `startDate`, `validUntil` ("current" if null), line count, a "Resets rollover" badge if `resetRollover=true`
- [x] Actions per row: [Copy] (opens dialog pre-filled), [Edit] (opens dialog), [Delete] (confirm → call DELETE)
- [x] `[+ New Budget]` button opens `BudgetFormDialog` in "create" mode
- [x] Empty state: "No budgets yet. Create your first budget."

---

### 13 — `BudgetFormDialog` Component

**File:** `src/components/budgets/budget-form-dialog.tsx` (new)

Modes: `create`, `edit`, `copy` (copy = pre-fill startDate from source but create new)

- [x] `startDate` field — date input (HTML `<input type="date">` or calendar picker)
- [x] `resetRollover` checkbox — label "Reset rollover at this budget's start date" with an info icon / `Tooltip` (or `Popover`) explaining: _"When checked, all budget line rollovers start at zero from this budget's start date, ignoring previous budgets. When unchecked, rollover is carried forward from the prior budget chain."_
- [x] `copyFrom` dropdown — shown only in `create` mode; lists existing budgets by formatted startDate; optional
- [x] On submit:
  - Create: if `copyFrom` selected → `POST /api/budgets/[copyFrom]/copy`; else → `POST /api/budgets`
  - Edit: `PUT /api/budgets/[id]`
- [x] Call `onSuccess` prop after successful save

---

### 14 — Update `src/app/budget/page.tsx`

- [x] Change `fetchSummary` to parse response as `BudgetSummaryResponse` and extract `activeBudget`
- [x] Store `activeBudget` in state
- [x] In the page header, add a `Link` to `/budgets` showing: "Budget effective [format(activeBudget.startDate, 'MMM d, yyyy')]" (or "No budget — manage budgets" if null)
- [x] Pass `activeBudget.id` to `BudgetCategoryDialog` and `BudgetLineDialog` props
- [x] Guard line/category creation buttons against `activeBudget === null` (disable with tooltip if no budget)

---

### 15 — Update Budget Dialogs

**Files:** `src/components/budget/budget-category-dialog.tsx`, `src/components/budget/budget-line-dialog.tsx`

- [x] `BudgetCategoryDialog` — accept `budgetId: string` prop; include in `POST /api/budget-categories` body
- [x] `BudgetLineDialog` — accept `budgetId: string` prop; include in `POST /api/budget-lines` body
- [x] Update call sites in `budget/page.tsx` to pass `budgetId={activeBudget?.id}`
