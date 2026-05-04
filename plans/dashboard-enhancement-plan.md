# Dashboard Enhancement Plan

## Overview

Rebuild the dashboard to surface the most important financial information and add an Income Sources section to the
budget page.

---

## 1. Database Schema Changes

### New model: `IncomeSource`

Linked to a `Budget` (resolved by the active budget for the selected time period).

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
```

### New models: `UntrackedCategory` and `UntrackedCategoryTag`

These are dashboard-level categories for spending that falls outside budget lines.

```prisma
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

### Model updates

- `Budget` model: add `incomeSources IncomeSource[]`, `untrackedCategories UntrackedCategory[]`
- `Tag` model: add `untrackedCategories UntrackedCategoryTag[]`

---

## 2. Utility Function: `getYearlyAmount`

Add to `src/lib/date-utils.ts`:

```ts
export function getYearlyAmount(amount: number, period: BudgetPeriodType): number {
  switch (period) {
    case 'monthly':
      return amount * 12;
    case 'biweekly':
      return amount * 26;
    case 'yearly':
      return amount;
  }
}
```

---

## 3. New API Routes

### `GET/POST /api/income-sources`

- `GET ?budgetId=...` → returns `IncomeSource[]` sorted by `order`
- `POST` body: `{ budgetId, name, netAmount, netPeriod, grossAmount?, grossPeriod?, order? }`

### `PATCH/DELETE /api/income-sources/[id]`

- `PATCH` body: partial `IncomeSource` fields
- `DELETE` removes the record

### `GET/POST /api/untracked-categories`

- `GET ?budgetId=...&start=...&end=...` → returns each category with `actualSpending` and `tags[]`, plus
  `totalTrulyUncategorized`
  - **Spending logic**: for each transaction in period with `debit > 0`:
    - If it has non-source tags not in ANY budget line tag set → it's "untracked"
    - Among untracked transactions: if any tag belongs to an untracked category's expanded tag set → assign to that
      category
    - Remaining untracked (no tags, or tags not in any untracked category) → `totalTrulyUncategorized`
  - Uses `collectDescendantTagIds` for tag expansion
- `POST` body: `{ budgetId, name, tagIds: string[], order? }`

### `PATCH/DELETE /api/untracked-categories/[id]`

- `PATCH` body: `{ name?, tagIds?: string[], order? }`
- `DELETE` removes the record and its tag associations

### Enhancement: `GET /api/transactions`

Add support for `tagIds` query param (comma-separated list) as an OR filter, so the sidebar can fetch transactions
matching any of the untracked category's tags.

---

## 4. New Types (`src/types/index.ts`)

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

export type UntrackedCategory = {
  id: string;
  budgetId: string;
  name: string;
  order: number;
  tags: TagFlat[];
  actualSpending?: number; // computed, returned by GET endpoint with dates
};
```

---

## 5. Budget Page Changes

### New component: `IncomeSourceDialog` (`src/components/budget/income-source-dialog.tsx`)

Form dialog for creating/editing an income source:

- Fields: Name, Net Amount, Net Period (monthly/biweekly/yearly), Gross Amount (optional), Gross Period (optional)
- Shows calculated yearly amounts for preview

### New component: `IncomeSourcesSection` (`src/components/budget/income-sources-section.tsx`)

Editable table displayed on the budget page:

| Name      | Net Amount | Period    | Yearly Net  | Gross Amount | Period | Yearly Gross |
| --------- | ---------- | --------- | ----------- | ------------ | ------ | ------------ |
| Salary    | $3,489     | Bi-weekly | $90,714     | $160,000     | Yearly | $160,000     |
| **Total** |            |           | **$90,714** |              |        | **$160,000** |

- Create/edit/delete buttons
- Read-only on dashboard

### Budget page wiring (`src/app/budget/page.tsx`)

- Fetch income sources for `activeBudget.id` via `/api/income-sources?budgetId=...`
- Render `<IncomeSourcesSection>` above the budget line table
- Pass `activeBudget.id` and callbacks for CRUD

---

## 6. Dashboard Page Sections

### Section 1: Expected Income (`src/components/dashboard/income-sources-card.tsx`)

Read-only table, same columns as `IncomeSourcesSection` but no edit controls. Fetched from
`/api/income-sources?budgetId=...`.

### Section 2: Table of Expenses (`src/components/dashboard/expenses-table.tsx`)

Read-only; data from `/api/budget/summary`. Grouped by `BudgetCategory`, same nesting as the budget page but
simplified (no drag handles, no actions).

Columns:
| Name | Amount | Period | Yearly Total | % of Yearly Budget | % of Income |
|------|----|-------|------------|-----------------|------------|

- **Amount**: `scaledBudget` (already in summary response)
- **Period**: `budgetLine.period`
- **Yearly Total**: `getYearlyAmount(budgetLine.amount, budgetLine.period)`
- **% of Yearly Budget**: line yearly / sum of all lines yearly × 100
- **% of Income**: line yearly / total yearly net income × 100 (from income sources)
- Category rows show subtotals

### Section 3: Untracked Categories (`src/components/dashboard/untracked-categories-section.tsx`)

Editable table (create/edit/delete on dashboard). Data from `/api/untracked-categories`.

Columns:
| Name | Linked Tags | Amount | % of Income |
|------|------------|--------|------------|

- Last row: **Uncategorized** (highlighted in amber) — `totalTrulyUncategorized` from API
- Clicking a row opens the transaction sidebar (`TagTransactionsPanel` reused/adapted with `tagIds` support)
- "Create new category" button at top
- Edit/delete buttons per row

**Sidebar**: Adapts `TagTransactionsPanel` to accept `tagIds: string[]` and fetch
`/api/transactions?tagIds=...&start=...&end=...`. Can reuse `TagTransactionsPanel` with a different props shape or
create `UntrackedTransactionsPanel`.

### Section 4: Charts (`src/components/dashboard/spending-charts.tsx`)

Uses `recharts`. Two charts side-by-side or stacked:

**Chart A: Budget Category Spending (Horizontal Bar)**

- X-axis: dollar amounts
- Y-axis: budget categories (sorted desc by actual spending)
- Two bars per category: Budget (gray) vs Actual (category color or blue/red)
- Handles large value spread naturally (longest bars at top)
- Toggle for log scale

**Chart B: Untracked Category Spending (Horizontal Bar)**

- Same layout as Chart A
- Each bar = actual spending for that untracked category
- Final bar = "Uncategorized" (highlighted amber)

**Chart C (suggested): Income vs Expenses Breakdown**

- Single horizontal stacked bar
- Segments: each budget category + untracked + uncategorized + savings (remainder)
- Uses income total as 100%

All charts use `ResponsiveContainer` and `Tooltip` with `formatCurrency`.

---

## 7. Dashboard Page Rebuild (`src/app/page.tsx`)

Data fetching strategy (parallel where possible):

1. `GET /api/budget/summary?start=...&end=...` → `summaryData` (budget lines + income totals)
2. `GET /api/income-sources?budgetId=...` → `incomeSources`
3. `GET /api/untracked-categories?budgetId=...&start=...&end=...` → `untrackedCategories` + `totalTrulyUncategorized`

Layout:

```
Dashboard
├── [Period Selector - in header, already exists]
├── 1. Expected Income (read-only IncomeSourcesCard)
├── 2. Table of Expenses (read-only ExpensesTable)
├── 3. Untracked Categories (editable UntrackedCategoriesSection)
└── 4. Charts (SpendingCharts)
     ├── Budget Category Spending (horizontal bar)
     ├── Untracked Category Spending (horizontal bar)
     └── Income vs Expenses Breakdown (stacked bar)
```

---

## 8. Component File Structure

```
src/components/
  budget/
    income-source-dialog.tsx      ← new: create/edit form
    income-sources-section.tsx    ← new: editable table for budget page
    [existing files unchanged]
  dashboard/
    income-sources-card.tsx       ← new: read-only income table
    expenses-table.tsx            ← new: read-only budget lines with % columns
    untracked-category-dialog.tsx ← new: create/edit form
    untracked-categories-section.tsx ← new: editable table with sidebar
    spending-charts.tsx           ← new: recharts bar charts
```

---

## 9. Key Design Decisions

### Yearly Amount Calculation

- Monthly × 12, Bi-weekly × 26, Yearly × 1
- Used for: income sources display, expense table columns, % of income calculations

### Untracked Category Spending Logic

A transaction counts toward an untracked category if:

1. It is NOT already matched by any budget line (no non-source tags in any budget line's expanded tag set), AND
2. At least one of its non-source tags is in the untracked category's expanded tag set

"Truly uncategorized" = untracked transactions with no matching untracked category (including completely untagged
transactions).

### Chart Scale for Large Value Differences

- Use horizontal bar chart (sorted descending) — visually easier to read than vertical
- Add a log-scale toggle button above the chart
- Use `scale="log"` on the `XAxis` when toggled (recharts supports this via `scale` prop on `XAxis`)

### UntrackedCategoryTag Expansion

Same logic as `BudgetLineTag` — uses `collectDescendantTagIds` to include all child tags. This means tagging a parent
tag on an untracked category automatically includes all its children's spending.

---

## 10. Migration Strategy

Since this is SQLite + local dev:

- Run `npx prisma migrate dev --name add_income_sources_and_untracked_categories`
- No data migration needed (new tables start empty)
