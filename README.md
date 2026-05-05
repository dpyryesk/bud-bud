# Budget Buddy (BudBud)

Budget Buddy is a personal budgeting app for tracking transactions, organizing spending with tags, and planning monthly
budgets with budget lines. It also supports CSV import so you can quickly bring in data from your bank and map columns
once for reuse.

## Features

- Dashboard with income summary, spending charts, expenses table, and untracked-category breakdown
- Multiple time-scoped budgets — create a new budget version whenever your plan changes
- Budget lines with planned amounts per period, grouped into drag-and-drop categories
- Income sources with net and gross amounts across monthly, bi-weekly, and yearly periods
- Untracked categories — name and group tagged spending that falls outside budget lines
- Transaction management with manual tag assignment and advanced filtering
- Tag management (create, edit, color-code, and organize tags hierarchically)
- CSV import with preview and column mapping (saved per source for reuse)
- Auto-tagging rules to speed up transaction categorization
- Bi-weekly period support (handles two- or three-occurrence months correctly)

## Getting Started

### 1) Install dependencies

```bash
pnpm install
```

### 2) Configure environment

Copy `.env.example` to `.env` and set the database URL.

### 3) Run database setup

```bash
pnpm prisma migrate dev
```

### 4) Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to Use the App

### 1) Create tags

1. Open **Tags** in the sidebar.
2. Click **Create Tag**.
3. Enter a tag name (for example: `Groceries`, `Rent`, `Utilities`, `Dining Out`).
4. Save the tag.
5. Repeat for all categories you want to track.

Tip: Keep tag names consistent and simple to make reporting clearer. Tags support parent–child nesting — create broad
parent tags first, then add children for finer detail.

### 2) Set up a budget

#### Manage budgets

1. Open **Manage Budgets** in the sidebar.
2. Click **New Budget** and set a start date.
3. Each budget is valid from its start date until the next budget's start date (or indefinitely for the latest one).
4. Use **Copy** on an existing budget to duplicate all its lines and categories into a new version.

Tip: Create a new budget whenever your financial situation changes significantly — your history is always preserved
under the old budget.

#### Add income sources

1. Open **Budget** in the sidebar.
2. Scroll to the **Income Sources** section and click **Add Income Source**.
3. Enter a name (e.g. `Salary`, `Freelance`), the net amount, and the pay period (`monthly`, `bi-weekly`, or `yearly`).
4. Optionally record the gross amount and its period for reference.
5. Save and repeat for every income stream.

Income sources are used by the dashboard to calculate available income and savings rate.

#### Add budget lines

1. In **Budget**, click **Add Budget Line** (or **Add Line** inside a category).
2. Select the period you want to plan for.
3. Choose a tag for the line.
4. Enter the planned amount for that category.
5. Save and repeat for each tag/category you budget.

Tip: Start with high-level categories first, then split into finer categories later if needed.

#### Organize lines into categories

1. In **Budget**, click **Add Category** to create a named group.
2. Drag budget lines into the category using the drag handle.
3. Categories display subtotals and can themselves be reordered by drag-and-drop.

### 3) Import CSV files

1. Open **Import** in the sidebar.
2. Upload your bank/export CSV file.
3. Review the preview table.
4. Map CSV columns (date, description, debit, credit, etc.) to app fields.
5. Save the mapping so future imports from the same source are faster.
6. Confirm import to create transactions.

Tip: Use a small sample CSV first to verify mapping behavior before importing a full statement history.

### 4) Tag transactions

1. Open **Transactions** in the sidebar.
2. Use the filter bar to narrow by date range, tag, amount, or search text.
3. Open a transaction and assign one or more tags.
4. Save changes.
5. (Optional) Create auto-tag rules for repeated merchant patterns.

Tip: After tagging, revisit **Budget** and **Dashboard** to confirm spending is landing in the expected categories.

### 5) Review the dashboard

The **Dashboard** shows a snapshot of the selected time period:

- **Income sources card** — total net income scaled to the period, with a per-source breakdown.
- **Spending charts** — visual breakdown of actual vs. budgeted spending by tag.
- **Expenses table** — line-by-line comparison of budgeted vs. actual amounts.
- **Untracked categories** — spending that has a tag but no matching budget line. Group these into named dashboard
  categories (e.g. `Irregular`, `One-off`) so they don't clutter the main view. Transactions inside an untracked
  category can be reviewed in a slide-out panel.

### 6) Set up untracked categories (optional)

1. On the **Dashboard**, scroll to the **Untracked** section.
2. Click **Add Category** and give it a name.
3. Assign tags whose spending you want grouped under that category.
4. The dashboard will show the total for that group and let you drill into individual transactions.

Tip: Use untracked categories for irregular or one-off expenses that you don't want to plan a formal budget line for.

## Recommended Workflow

1. Create your base tags.
2. Open **Manage Budgets** and create a budget with a start date.
3. Add income sources to the budget.
4. Add budget lines (optionally grouped into categories).
5. Import CSV transactions.
6. Tag uncategorized transactions (use auto-tag rules for recurring merchants).
7. Review the **Dashboard** — check the income summary, spending charts, and untracked categories.
8. Adjust budget lines over time; create a new budget version when your plan changes significantly.
