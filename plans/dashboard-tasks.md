# Dashboard Enhancement — Agent Task Prompts

Each task below is self-contained and can be copy-pasted as an agent prompt in Code mode.
Tasks must be executed in order (each one builds on the previous).

Read `plans/dashboard-enhancement-plan.md` for the full architectural context before starting any task.

---

## Task 1 — Database Schema: Add IncomeSource, UntrackedCategory models

**IMPORTANT:** USE MIGRATIONS TO PRESERVE DATA.

**Files to edit:** `prisma/schema.prisma`

Add the following models to `prisma/schema.prisma`:

```prisma
model IncomeSource {
  id          String   @id @default(cuid())
  budgetId    String
  budget      Budget   @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  name        String
  netAmount   Float
  netPeriod   String   // "monthly" | "biweekly" | "yearly"
  grossAmount Float?
  grossPeriod String?  // "monthly" | "biweekly" | "yearly"
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UntrackedCategory {
  id        String                 @id @default(cuid())
  budgetId  String
  budget    Budget                 @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  name      String
  order     Int                    @default(0)
  createdAt DateTime               @default(now())
  updatedAt DateTime               @updatedAt
  tags      UntrackedCategoryTag[]
}

model UntrackedCategoryTag {
  id                  String            @id @default(cuid())
  untrackedCategoryId String
  tagId               String
  untrackedCategory   UntrackedCategory @relation(fields: [untrackedCategoryId], references: [id], onDelete: Cascade)
  tag                 Tag               @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([untrackedCategoryId, tagId])
}
```

Also update the existing `Budget` model to add these relations:

```prisma
  incomeSources       IncomeSource[]
  untrackedCategories UntrackedCategory[]
```

And the existing `Tag` model to add:

```prisma
  untrackedCategories UntrackedCategoryTag[]
```

Then run the migration:

```
npx prisma migrate dev --name add_income_sources_and_untracked_categories
```

---

## Task 2 — Types & Utilities

**Files to edit:** `src/types/index.ts`, `src/lib/date-utils.ts`

### `src/lib/date-utils.ts`

Add the `getYearlyAmount` function after the existing `scaleBudgetAmount` function:

```ts
/**
 * Convert a budget amount to its yearly equivalent.
 * monthly × 12, biweekly × 26, yearly × 1.
 */
export function getYearlyAmount(amount: number, period: BudgetPeriodType): number {
  switch (period) {
    case 'monthly':
      return amount * 12;
    case 'biweekly':
      return amount * 26;
    case 'yearly':
      return amount;
    default:
      return amount;
  }
}
```

### `src/types/index.ts`

Add these new exported types (add after the existing budget types):

```ts
export type IncomeSource = {
  id: string;
  budgetId: string;
  name: string;
  netAmount: number;
  netPeriod: BudgetPeriodType;
  grossAmount: number | null;
  grossPeriod: BudgetPeriodType | null;
  order: number;
};

export type UntrackedCategoryWithSpending = {
  id: string;
  budgetId: string;
  name: string;
  order: number;
  tags: TagFlat[];
  actualSpending: number;
};

export type UntrackedCategoriesResponse = {
  categories: UntrackedCategoryWithSpending[];
  totalTrulyUncategorized: number;
  trulyUncategorizedTransactions: TransactionWithTags[];
};
```

---

## Task 3 — API: Income Sources CRUD

**Files to create:**

- `src/app/api/income-sources/route.ts`
- `src/app/api/income-sources/[id]/route.ts`

### `src/app/api/income-sources/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/income-sources?budgetId=...
export async function GET(request: NextRequest) {
  const budgetId = request.nextUrl.searchParams.get('budgetId');
  if (!budgetId) {
    return NextResponse.json({ error: 'budgetId is required' }, { status: 400 });
  }
  const sources = await prisma.incomeSource.findMany({
    where: { budgetId },
    orderBy: { order: 'asc' },
  });
  return NextResponse.json(sources);
}

// POST /api/income-sources
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { budgetId, name, netAmount, netPeriod, grossAmount, grossPeriod, order } = body;
  if (!budgetId || !name || netAmount == null || !netPeriod) {
    return NextResponse.json(
      { error: 'budgetId, name, netAmount, netPeriod are required' },
      { status: 400 },
    );
  }
  const source = await prisma.incomeSource.create({
    data: {
      budgetId,
      name,
      netAmount: Number(netAmount),
      netPeriod,
      grossAmount: grossAmount != null ? Number(grossAmount) : null,
      grossPeriod: grossPeriod ?? null,
      order: order ?? 0,
    },
  });
  return NextResponse.json(source, { status: 201 });
}
```

### `src/app/api/income-sources/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/income-sources/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const { name, netAmount, netPeriod, grossAmount, grossPeriod, order } = body;
  const updated = await prisma.incomeSource.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(netAmount !== undefined && { netAmount: Number(netAmount) }),
      ...(netPeriod !== undefined && { netPeriod }),
      ...(grossAmount !== undefined && {
        grossAmount: grossAmount != null ? Number(grossAmount) : null,
      }),
      ...(grossPeriod !== undefined && { grossPeriod: grossPeriod ?? null }),
      ...(order !== undefined && { order }),
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/income-sources/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  await prisma.incomeSource.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
```

---

## Task 4 — API: Untracked Categories CRUD + Spending

**Files to create:**

- `src/app/api/untracked-categories/route.ts`
- `src/app/api/untracked-categories/[id]/route.ts`

### Spending logic for `GET /api/untracked-categories`

A transaction counts toward an untracked category if:

1. It has `debit > 0` (it is a spending transaction)
2. None of its non-source tags are in ANY budget line's expanded tag set (it is "untracked" from the budget's perspective)
3. At least one of its non-source tags is in the untracked category's expanded tag set (using `collectDescendantTagIds`)

"Truly uncategorized" = untracked transactions that match no untracked category (including completely untagged transactions).

Use `collectDescendantTagIds` from `@/lib/tag-tree` for tag expansion (same pattern as `budget/untracked/route.ts`). Load budget lines and their tags from the applicable budget, build the `allBudgetTagIds` set, then do the category matching in memory.

The `GET` endpoint needs `?budgetId=...&start=YYYY-MM-DD&end=YYYY-MM-DD`.

Include `trulyUncategorizedTransactions` in the response (same format as the untracked route: id, date, name, normalizedName, debit, credit, source, notes, tags).

### `src/app/api/untracked-categories/[id]/route.ts`

```ts
// PATCH updates: name, tagIds (replaces all tag associations), order
// DELETE removes category and cascades tag associations
```

---

## Task 5 — API: Enhance Transactions Endpoint

**File to edit:** `src/app/api/transactions/route.ts`

Read the current file first. Add support for a `tagIds` query parameter (comma-separated list of tag IDs). When `tagIds` is provided (instead of `tagId`), filter transactions that have ANY of the listed tag IDs. This is used by the untracked category sidebar to show transactions for multiple tags at once.

---

## Task 6 — Budget Page: IncomeSourceDialog component

**File to create:** `src/components/budget/income-source-dialog.tsx`

Create a dialog component for creating and editing income sources. Follow the same patterns as `src/components/budget/budget-line-dialog.tsx`.

Requirements:

- Uses `Dialog` from `@/components/ui/dialog` and `Button` from `@/components/ui/button`
- Has a trigger button (shown when `editingSource` is null) and can be controlled externally via `open`/`onOpenChange` props
- Form fields:
  - **Name** (text input, required)
  - **Net Amount** (number input, required, 2 decimal places)
  - **Net Period** (select: Monthly / Bi-weekly / Yearly, required)
  - **Gross Amount** (number input, optional)
  - **Gross Period** (select: Monthly / Bi-weekly / Yearly, shown only when Gross Amount is provided)
- Show a computed "Yearly Net" and "Yearly Gross" preview below the inputs using `getYearlyAmount` from `@/lib/date-utils`
- On submit: POST to `/api/income-sources` (create) or PATCH to `/api/income-sources/[id]` (edit)
- Props:
  ```ts
  interface IncomeSourceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    budgetId: string | null;
    editingSource: IncomeSource | null;
    triggerDisabled?: boolean;
    onSuccess: () => Promise<void>;
  }
  ```
- The `IncomeSource` type comes from `@/types`
- Use `BudgetPeriodType` from `@/types` for the period options

---

## Task 7 — Budget Page: IncomeSourcesSection component

**File to create:** `src/components/budget/income-sources-section.tsx`

Create a section component displaying the income sources table on the budget page.

Requirements:

- Fetches income sources from `/api/income-sources?budgetId=...` when `budgetId` changes
- Shows a table with columns: **Name**, **Net Amount**, **Net Period**, **Yearly Net**, **Gross Amount**, **Gross Period**, **Yearly Gross**, **Actions**
- Uses `getYearlyAmount` from `@/lib/date-utils` to compute yearly values
- Shows a totals row (sum of all yearly net, sum of all yearly gross)
- Has an `IncomeSourceDialog` button to create new sources
- Each row has edit (pencil) and delete (trash) icon buttons
- Delete confirms with `window.confirm`
- Calls `onRefresh` prop after successful mutations
- Props:
  ```ts
  interface IncomeSourcesSectionProps {
    budgetId: string | null;
    onRefresh?: () => void;
  }
  ```
- Imports `IncomeSource` from `@/types`, `IncomeSourceDialog` from `./income-source-dialog`
- Use `formatCurrency` from `@/lib/date-utils`
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent` from `@/components/ui/card`

---

## Task 8 — Budget Page: Wire IncomeSourcesSection

**File to edit:** `src/app/budget/page.tsx`

Read the full current file. Add the `IncomeSourcesSection` component to the budget page:

- Import `IncomeSourcesSection` from `@/components/budget/income-sources-section`
- Render it in the JSX between the summary cards and the DnD budget line table
- Pass `budgetId={activeBudget?.id ?? null}`
- Pass `onRefresh={refresh}` so it triggers a refresh of budget totals after income source changes

---

## Task 9 — Dashboard: IncomeSourcesCard component (read-only)

**File to create:** `src/components/dashboard/income-sources-card.tsx`

Create a read-only card component showing the income sources table on the dashboard.

Requirements:

- Accepts `incomeSources: IncomeSource[]` as a prop (already fetched by the parent page)
- Displays the same columns as `IncomeSourcesSection` but with NO action buttons: **Name**, **Net Amount**, **Period**, **Yearly Net**, **Gross Amount** (if present), **Period**, **Yearly Gross** (if present)
- Shows a totals row
- If no income sources, shows a message: "No income sources configured. Add them on the Budget page."
- Uses `Card` wrapper with title "Expected Income"
- Exports `IncomeSourcesCard`

---

## Task 10 — Dashboard: ExpensesTable component (read-only)

**File to create:** `src/components/dashboard/expenses-table.tsx`

Create a read-only budget expenses table for the dashboard.

Requirements:

- Props:
  ```ts
  interface ExpensesTableProps {
    summaryLines: BudgetSummaryLine[];
    orderedCategories: BudgetCategory[];
    totalYearlyNetIncome: number; // sum of all income sources' yearly net amounts
  }
  ```
- Columns: **Name**, **Amount** (scaledBudget for selected period), **Period**, **Yearly Total**, **% of Yearly Budget**, **% of Income**
- Grouped by category (same grouping logic as the budget page, but read-only)
- Each category row shows its subtotals
- A final "Uncategorized" group for lines with no category
- "% of Yearly Budget" = `getYearlyAmount(line.amount, line.period) / totalYearlyBudget * 100`
- "% of Income" = `getYearlyAmount(line.amount, line.period) / totalYearlyNetIncome * 100` (show "—" if income is 0)
- Use `formatCurrency` and `getYearlyAmount` from `@/lib/date-utils`
- Use `Card` wrapper with title "Budget Expenses"
- Import types from `@/types`

---

## Task 11 — Dashboard: UntrackedCategoryDialog component

**File to create:** `src/components/dashboard/untracked-category-dialog.tsx`

Create a dialog for creating/editing untracked categories on the dashboard.

Requirements:

- Props:
  ```ts
  interface UntrackedCategoryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    budgetId: string | null;
    editingCategory: UntrackedCategoryWithSpending | null;
    availableTags: TagOptionWithLevel[]; // use existing TagOptionWithLevel from budget/constants
    onSuccess: () => Promise<void>;
  }
  ```
- Form fields:
  - **Name** (text input, required)
  - **Tags** (multi-select using the existing `TagSelectorDropdown` component from `@/components/tags/tag-selector-dropdown`)
- On submit: POST to `/api/untracked-categories` (create) or PATCH to `/api/untracked-categories/[id]` (edit)
- POST body: `{ budgetId, name, tagIds: string[] }`
- PATCH body: `{ name, tagIds: string[] }`
- Import `UntrackedCategoryWithSpending` from `@/types`
- Import `TagOptionWithLevel` from `@/components/budget/constants`

---

## Task 12 — Dashboard: UntrackedCategoriesSection component

**File to create:** `src/components/dashboard/untracked-categories-section.tsx`

Create the editable untracked categories table for the dashboard.

Requirements:

- Props:
  ```ts
  interface UntrackedCategoriesSectionProps {
    budgetId: string | null;
    period: TimePeriod;
    totalYearlyNetIncome: number;
    availableTags: TagOptionWithLevel[];
  }
  ```
- Fetches from `/api/untracked-categories?budgetId=...&start=...&end=...`
- Table columns: **Name**, **Linked Tags** (tag badges), **Amount** (actual spending), **% of Income**, **Actions** (edit/delete)
- Final row: "Uncategorized" with `totalTrulyUncategorized` — highlighted with amber text and a warning icon, no actions
- "Create new category" button at top
- Each row shows per-row edit (pencil) and delete (trash) buttons
- Clicking a non-uncategorized row name opens a transaction sidebar (see below)
- The sidebar should show transactions for the clicked category's tags
  - Create a `UntrackedTransactionsPanel` component (inline or separate file `src/components/dashboard/untracked-transactions-panel.tsx`) based on the existing `TagTransactionsPanel`
  - It fetches `/api/transactions?tagIds=tag1,tag2&start=...&end=...&limit=200`
  - Shows the same transaction list UI as `TagTransactionsPanel`
- Clicking the "Uncategorized" row opens a sidebar showing the `trulyUncategorizedTransactions` (already in the API response — no extra fetch needed, pass them directly)
- Use `Card` wrapper with title "Untracked Spending"
- Use `UntrackedCategoryDialog` for create/edit
- Import types from `@/types`, `buildTagsInDisplayOrder` from `@/lib/tag-tree`

---

## Task 13 — Dashboard: SpendingCharts component

**File to create:** `src/components/dashboard/spending-charts.tsx`

Create bar chart components for the dashboard. Uses `recharts` (already installed).

Requirements:

- Props:
  ```ts
  interface SpendingChartsProps {
    summaryLines: BudgetSummaryLine[];
    orderedCategories: BudgetCategory[];
    untrackedCategories: UntrackedCategoryWithSpending[];
    totalTrulyUncategorized: number;
  }
  ```

**Chart A: Budget Category Spending** (horizontal grouped bar)

- One bar pair per category: "Budget" (gray) and "Actual" (blue or red if over budget)
- Data: sum `scaledBudget` and `actualSpending` across all lines in each category
- Sorted descending by actual spending
- X-axis uses `formatCurrency`
- Log scale toggle button (state: `logScale`, switches `XAxis scale` prop between `'auto'` and `'log'`)

**Chart B: Untracked Spending** (horizontal bar)

- One bar per untracked category + one amber "Uncategorized" bar at end
- Each bar = `actualSpending`
- No log scale needed
- X-axis uses `formatCurrency`

Both charts:

- Use `BarChart` with `layout="vertical"`, `ResponsiveContainer`, `Tooltip`, `Legend`, `XAxis`, `YAxis`
- Wrap each in a `Card` with appropriate title
- Keep file under 250 lines — split into `BudgetCategoryChart` and `UntrackedChart` sub-components if needed

---

## Task 14 — Dashboard Page: Rebuild src/app/page.tsx

**File to edit:** `src/app/page.tsx`

Rebuild the dashboard page to compose all new sections.

Data fetching:

1. `/api/budget/summary?start=...&end=...` → get `activeBudget`, `lines`, `totalIncome`, `totalDebits`
2. `/api/income-sources?budgetId=...` → get `incomeSources` (only if `activeBudget` is not null)
3. Untracked categories are fetched internally by `UntrackedCategoriesSection`
4. Tags for `UntrackedCategoryDialog` — fetch `/api/tags` and filter non-source, apply `buildTagsInDisplayOrder`

Derived values (computed from fetched data):

- `orderedCategories` — extract unique categories from `lines`, sorted by `line.budgetLine.category.order`
- `totalYearlyNetIncome` — sum of `getYearlyAmount(src.netAmount, src.netPeriod)` for each income source
- `totalYearlyBudget` — sum of `getYearlyAmount(line.budgetLine.amount, line.budgetLine.period)` for each summary line

Layout:

```tsx
<div className="space-y-6">
  <h1>Dashboard</h1>
  <p>Showing data for: {period.label}</p>

  {/* 1. Expected Income */}
  <IncomeSourcesCard incomeSources={incomeSources} />

  {/* 2. Table of Expenses */}
  <ExpensesTable
    summaryLines={summaryLines}
    orderedCategories={orderedCategories}
    totalYearlyNetIncome={totalYearlyNetIncome}
  />

  {/* 3. Untracked Categories */}
  <UntrackedCategoriesSection
    budgetId={activeBudget?.id ?? null}
    period={period}
    totalYearlyNetIncome={totalYearlyNetIncome}
    availableTags={tags}
  />

  {/* 4. Charts */}
  <SpendingCharts
    summaryLines={summaryLines}
    orderedCategories={orderedCategories}
    untrackedCategories={untrackedCategories}
    totalTrulyUncategorized={totalTrulyUncategorized}
  />
</div>
```

Note: `untrackedCategories` and `totalTrulyUncategorized` must be lifted from `UntrackedCategoriesSection` OR the page can also fetch them directly for the charts. Decide during implementation which approach is cleaner.

The page should handle the "no budget" state gracefully (show a message directing users to create a budget).
