# Budget Buddy (BudBud)

Budget Buddy is a personal budgeting app for tracking transactions, organizing spending with tags, and planning monthly budgets with budget lines. It also supports CSV import so you can quickly bring in data from your bank and map columns once for reuse.

## Features

- Dashboard summary of budget vs. actual spending
- Transaction management with manual tag assignment
- Tag management (create, edit, and organize tags)
- Budget lines with planned amounts per time period
- CSV import with preview and column mapping
- Auto-tagging rules to speed up transaction categorization

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

Tip: Keep tag names consistent and simple to make reporting clearer.

### 2) Create budget lines

1. Open **Budget** in the sidebar.
2. Click **Add Budget Line**.
3. Select the period you want to plan for.
4. Choose a tag for the line.
5. Enter the planned amount for that category.
6. Save and repeat for each tag/category you budget.

Tip: Start with high-level categories first, then split into finer categories later if needed.

### 3) Import CSV files

1. Open **Import** in the sidebar.
2. Upload your bank/export CSV file.
3. Review the preview table.
4. Map CSV columns (date, description, debit, credit, etc.) to app fields.
5. Save mapping, so future imports are faster.
6. Confirm import to create transactions.

Tip: Use a small sample CSV first to verify mapping behavior before importing a full statement history.

### 4) Tag transactions

1. Open **Transactions** in the sidebar.
2. Filter or search for untagged transactions.
3. Open a transaction and assign one or more tags.
4. Save changes.
5. (Optional) Create auto-tag rules for repeated merchant patterns.

Tip: After tagging, revisit **Budget** and **Dashboard** to confirm spending is landing in the expected categories.

## Recommended Workflow

1. Create your base tags.
2. Create budget lines for those tags.
3. Import CSV transactions.
4. Tag uncategorized transactions.
5. Review the budget summary and adjust budget lines over time.
