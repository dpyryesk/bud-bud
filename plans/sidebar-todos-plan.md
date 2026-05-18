# Sidebar Todo & Warning Card — Implementation Plan

## Overview

Add a collapsible "Setup Checklist" card to the sidebar that surfaces actionable todo items and warnings. It includes a progress bar showing overall completion, and a checklist of all 9 tracked health checks. Completed items display a checkmark; pending items are clickable and navigate the user to the appropriate page.

---

## Check Items (9 total)

### TODOs (blue/info style when pending)

| #   | Label                   | Completed when                                     | Navigation             |
| --- | ----------------------- | -------------------------------------------------- | ---------------------- |
| 1   | Create transaction tags | `tagCount > 0`                                     | `/tags`                |
| 2   | Create a budget         | `hasBudget === true`                               | `/budgets`             |
| 3   | Add budget lines        | `budgetLineCount > 0`                              | `/budget`              |
| 4   | Add income sources      | `incomeSourceCount > 0`                            | `/budget`              |
| 5   | Import transactions     | `transactionCount > 0`                             | `/import`              |
| 6   | Set up auto-tag rules   | `autoTagRuleCount > 0` OR `transactionCount === 0` | `/tags#auto-tag-rules` |

### WARNINGs (amber style when pending)

| #   | Label                      | Completed when                                       | Action                                                          |
| --- | -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| 7   | Untagged transactions      | `untaggedTransactionCount === 0`                     | `setPreset('current-year')` + `/transactions?untaggedOnly=true` |
| 8   | Uncategorized transactions | `uncategorizedTransactionCount === 0`                | `setPreset('current-year')` + `/budget#yearly-untracked`        |
| 9   | Budget within income       | `yearlyBudget <= yearlyIncome OR yearlyIncome === 0` | Informational only                                              |

---

## Collapse Behavior

- **Collapsed state stored in localStorage** key: `sidebar-todos-collapsed`
- Default (no user preference):
  - All 9 complete → auto-collapse
  - Any pending → auto-expand
- Once user clicks the toggle header → preference saved to localStorage and overrides auto behavior
- Progress bar and item count (`6/9`) remain visible in the header even when collapsed

---

## Card Visual Design

```
┌─────────────────────────────────────────┐
│ 🎯 Setup Checklist              ▾ 6/9  │
│ ████████████░░░░░░░  6 of 9 complete   │  ← Progress component
├─────────────────────────────────────────┤
│ ✓ Create transaction tags              │  gray muted
│ ✓ Create a budget                      │  gray muted
│ ✓ Add budget lines                     │  gray muted
│ ✓ Add income sources                   │  gray muted
│ ✓ Import transactions                  │  gray muted
│ ○ Set up auto-tag rules           →    │  blue (TODO, clickable)
│ ⚠ 15 untagged transactions found  →    │  amber (WARNING, clickable)
│ ⚠ 3 uncategorized transactions    →    │  amber (WARNING, clickable)
│ ✓ Budget within income                 │  gray muted
└─────────────────────────────────────────┘
```

---

## New Files

### `src/app/api/app-health/route.ts`

Single `GET` endpoint. Response shape:

```ts
interface AppHealthResponse {
  tagCount: number;
  hasBudget: boolean;
  budgetLineCount: number;
  incomeSourceCount: number;
  transactionCount: number;
  autoTagRuleCount: number;
  untaggedTransactionCount: number;
  uncategorizedTransactionCount: number;
  yearlyBudget: number;
  yearlyIncome: number;
  currentYear: number;
}
```

DB queries (run in parallel where possible):

- `prisma.tag.count({ where: { isSource: false } })` → `tagCount`
- `prisma.budget.findMany({ orderBy: { startDate: 'asc' } })` → find active budget for today
- `prisma.budgetLine.count({ where: { budgetId } })` → `budgetLineCount`
- `prisma.incomeSource.count({ where: { budgetId } })` → `incomeSourceCount`; compute `yearlyIncome`
- `prisma.transaction.count({ where: { archived: false } })` → `transactionCount`
- `prisma.autoTagRule.count()` → `autoTagRuleCount`
- Untagged in current year: count transactions with no non-source tags, archived=false, debit > 0
- Uncategorized in current year: load tagged transactions in current year + budget lines + tags → count those that don't match any budget line (reuse logic from `/api/budget/untracked`)
- `yearlyBudget`: iterate budget lines, call `getYearlyAmount(line.amount, line.period)`

### `src/components/ui/progress.tsx`

Simple progress bar component (Radix-based or plain div). Used in the checklist card header.

### `src/components/layout/sidebar-todos-card.tsx`

Client component. Fetches `/api/app-health` on mount. Renders progress bar + checklist. Handles collapse toggle with localStorage.

---

## Modified Files

| File                                                 | Change                                                                 |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/components/layout/sidebar.tsx`                  | Add `<SidebarTodosCard />` below nav links                             |
| `src/app/tags/page.tsx`                              | Wrap `<AutoTagRulesSection>` with `<div id="auto-tag-rules">`          |
| `src/app/budget/page.tsx`                            | Wrap `<UntrackedCategoriesSection>` with `<div id="yearly-untracked">` |
| `src/components/transactions/transactions-table.tsx` | Add optional `initialUntaggedOnly?: boolean` prop                      |
| `src/app/transactions/page.tsx`                      | Read `?untaggedOnly=true` via `useSearchParams`, pass to table         |
