# Getting Started with Budget Buddy

This guide walks you through setting up Budget Buddy from scratch using the sample data in
[`sample-data/transactions-2026.csv`](sample-data/transactions-2026.csv). The sample file
contains 204 synthetic transactions spread across all 12 months of 2026, covering these vendor
categories:

| Category           | Vendors in the sample file                                                     |
| ------------------ | ------------------------------------------------------------------------------ |
| **Housing**        | Sunrise Mortgage Co                                                            |
| **Utilities**      | CityGas and Power                                                              |
| **Subscriptions**  | Netflix Subscription, Spotify Subscription, Amazon Prime Membership            |
| **Groceries**      | FreshMart Grocery, Whole Foods Market                                          |
| **Dining Out**     | Bella Pasta Restaurant, Maple Street Diner, Sakura Sushi Bar, The Burger Joint |
| **Entertainment**  | AMC Cinemas, Steam Gaming Platform, Ticketmaster Events                        |
| **Savings**        | Savings Transfer Emergency Fund                                                |
| **Transportation** | Shell Gas Station, ExxonMobil Fuel                                             |
| **Health**         | CVS Pharmacy                                                                   |
| **Shopping**       | Target Store                                                                   |

---

## Prerequisites

Choose **one** of the two options below. Docker is the easiest if you just want to run the app.

| Option          | What you need                                                             |
| --------------- | ------------------------------------------------------------------------- |
| **A — Docker**  | [Docker Desktop](https://www.docker.com/products/docker-desktop/)         |
| **B — Node.js** | [Node.js](https://nodejs.org/) `^20.19`, `^22.12`, or `>=24` and pnpm v10 |

---

## Step 0 — Run the application

### Option A — Docker (recommended)

Install [Docker Desktop](https://www.docker.com/products/docker-desktop/), then:

```bash
git clone https://github.com/dpyryesk/bud-bud.git
cd bud-bud
docker compose up
```

Docker builds the image on the first run (takes a few minutes), creates a verified backup before
upgrades, applies database migrations, and starts the server on localhost. Open
[http://localhost:3000](http://localhost:3000).

Your data is stored in `./data/bud.db` on the host and persists between restarts.

| Command                     | What it does                       |
| --------------------------- | ---------------------------------- |
| `docker compose up`         | Start (build on first run)         |
| `docker compose up --build` | Rebuild after pulling repo updates |
| `Ctrl+C`                    | Stop the server                    |
| `docker compose down`       | Stop and remove the container      |

### Option B — Node.js / pnpm

Clone the repository, then run:

```bash
pnpm bootstrap
```

That is the only command needed. It automatically:

1. Installs all dependencies (`pnpm install`).
2. Copies `.env.example` → `.env` if `.env` does not already exist (SQLite, no external database required).
3. Applies database migrations and regenerates the Prisma client.
4. Builds the production bundle and starts the server.

The database file `data/bud.db` is created on the first run. Before applying migrations, the setup
command automatically creates a verified `data/bud-backup-*.db` snapshot. Run `pnpm db:backup`
for an additional on-demand snapshot.

Open [http://localhost:3000](http://localhost:3000).

---

## Step 1 — Create tags

Tags are the labels you apply to transactions. Every budget line, every chart, and every filter in
the app works through tags, so creating them first is important.

> **Navigate to** → **Tags** in the sidebar.

Click **Create Tag** and add one tag for each spending category. Use the names below — they match
exactly what the sample budget and auto-tag rules in later steps reference.

### Suggested tag list

Create these tags as **top-level (root) tags**:

| Tag name         | What it covers                              |
| ---------------- | ------------------------------------------- |
| `Housing`        | Mortgage payments                           |
| `Utilities`      | Gas, electric, water bills                  |
| `Subscriptions`  | Streaming and membership fees               |
| `Groceries`      | Supermarket and grocery store runs          |
| `Dining Out`     | Restaurants, fast food, cafés               |
| `Entertainment`  | Cinema, gaming, concerts, events            |
| `Savings`        | Transfers to savings or investment accounts |
| `Transportation` | Fuel, transit, parking                      |
| `Health`         | Pharmacy, medical expenses                  |
| `Shopping`       | General retail purchases                    |

**Optional — add child tags for finer detail.** For example, under `Groceries` you could add
`FreshMart` and `Whole Foods` as children. The budget and dashboard can be filtered by parent tag,
which rolls up all children automatically.

**Tips:**

- Assign each tag a distinct color to make charts and lists easier to scan.
- Keep names short — they appear in table cells and chart legends.
- You can re-order tags by dragging them after creation.

### Source tags — tracking which account a transaction came from

In addition to spending-category tags, the app supports a special type called a **source tag**.
Source tags represent where a transaction originated — typically a bank account or credit card.
They behave differently from regular tags:

- They are **not** used in budget line calculations or auto-tag rules.
- They are **not** counted as "tagged" — a transaction that only has a source tag still appears in
  the untagged filter and will be processed by auto-tag rules.
- During CSV import you can select a source tag to stamp it on every imported row automatically,
  without any manual step.
- On the Transactions page you can filter by source tag to view all transactions from a specific
  account.

**To create a source tag:**

1. Click **Create Tag** on the Tags page.
2. Enter a name that identifies the account — e.g. `Checking Account`, `Visa Rewards`, or
   `Joint Account`.
3. Check the **Source tag** checkbox. This separates it from spending-category tags throughout
   the app and makes it available in the import wizard's source tag dropdown.
4. Pick a color and save.

If you import from a single bank account (as in this walkthrough), one source tag is enough. If
you have multiple accounts, create one source tag per account so you can filter by account later.
When you import the sample CSV in Step 4, you can optionally select a source tag so every
imported transaction is automatically stamped with it.

---

## Step 2 — Set up a budget

A budget is a named plan that is valid from a start date forward. You can have multiple budgets
over time — each one is a snapshot of your plan at that point.

### 2a — Create a new budget

> **Navigate to** → **Manage Budgets** in the sidebar.

Click **New Budget**. Set a start date of **2026-01-01**.
Save it.

### 2b — Open the budget editor

> **Navigate to** → **Budget** in the sidebar.

The **Budget** page is the main editing surface. You will see an empty budget with no lines yet.

### 2c — Add budget categories (optional but recommended)

Categories are visual groupings for budget lines. They don't affect calculations — they just keep
the page organized.

Click **Add Category** and create these groups:

- `Fixed Expenses`
- `Variable Expenses`
- `Goals`

### 2d — Add budget lines

Click **Add Line** (or **Add Line** inside a category). Each line has:

- **Tags** — one or more tags whose transactions count toward this line.
- **Planned amount** — how much you expect to spend in the chosen period.
- **Period** — monthly, bi-weekly, or yearly.
- **Carryover** — whether unused budget rolls into the next period.

Add the following lines, paying attention to the notes about multiple tags and carryover:

#### Fixed Expenses category

| Line name     | Tags            | Amount | Period  | Carryover |
| ------------- | --------------- | ------ | ------- | --------- |
| Mortgage      | `Housing`       | $2,100 | Monthly | Off       |
| Utilities     | `Utilities`     | $100   | Monthly | Off       |
| Subscriptions | `Subscriptions` | $49    | Monthly | Off       |

**Carryover is off for these** because a missed month of mortgage doesn't give you extra budget
next month — it's a fixed obligation.

#### Variable Expenses category

| Line name              | Tags                          | Amount | Period  | Carryover |
| ---------------------- | ----------------------------- | ------ | ------- | --------- |
| Groceries              | `Groceries`                   | $350   | Monthly | Off       |
| Dining & Entertainment | `Dining Out`, `Entertainment` | $200   | Monthly | On        |
| Fuel                   | `Transportation`              | $130   | Monthly | On        |
| Health & Pharmacy      | `Health`                      | $60    | Monthly | On        |

**Two tags on one line** — "Dining & Entertainment" groups `Dining Out` and `Entertainment`
together. This is useful when you think of them as a single discretionary bucket rather than two
separate caps. The line's actual spending is the combined total of transactions tagged with either
tag.

**Carryover is on for variable lines** — if you spend $150 on dining in January, the unused $50
rolls into February and gives you $250 to work with. This is great for lumpy categories like
entertainment (you might skip the cinema for two months and then buy concert tickets).

#### Goals category

| Line name      | Tags      | Amount | Period  | Carryover |
| -------------- | --------- | ------ | ------- | --------- |
| Emergency Fund | `Savings` | $500   | Monthly | On        |

**Carryover on for savings** — if you transfer more than planned one month, the surplus reduces
the required amount next month.

#### Lines intentionally left out of the budget

`Shopping` (Target Store) is not given a formal budget line here. It's irregular and hard to
predict. You will handle it as an **untracked category** on the dashboard in Step 6 instead.

---

## Step 3 — Add income sources

Income sources tell the dashboard how much money comes in each period. They are separate from
transactions — you enter them manually.

> **Navigate to** → **Budget** in the sidebar → scroll to the **Income Sources** section.

Click **Add Income Source** and enter:

| Name           | Net amount | Period  |
| -------------- | ---------- | ------- |
| Primary Salary | $5,200     | Monthly |
| Freelance Work | $800       | Monthly |

Fill in a gross amount if you want the dashboard to show both pre- and post-tax figures; otherwise
leave it blank.

**Why net income matters:** the dashboard uses net income to calculate your savings rate and how
much discretionary income is left after budget lines are satisfied.

---

## Step 4 — Import the sample CSV

> **Navigate to** → **Import** in the sidebar.

The import wizard has four steps: **Upload → Configure → Preview → Done**.

### Upload

Click **Choose file** and select `sample-data/transactions-2026.csv`.

The app shows you the first few rows of raw CSV data so you can identify which column holds which
field.

The sample file has four columns:

| Column | Header        | Contains                                       |
| ------ | ------------- | ---------------------------------------------- |
| 1      | `Date`        | Transaction date (YYYY-MM-DD)                  |
| 2      | `Description` | Vendor name                                    |
| 3      | `Withdrawal`  | Amount spent (debit)                           |
| 4      | `Deposit`     | Amount received (credit) — blank for most rows |

### Configure

Map the columns:

- **Date column** → `1`
- **Description column** → `2`
- **Debit column** → `3`
- **Credit column** → `4`
- **Date format** → `YYYY-MM-DD (ISO)`
- **Source column** → _(leave as None)_
- **Skip first row (it is a header)** → **Checked**

Give the mapping a name (e.g. `Sample Bank`) and save it. Saved mappings are reused automatically
on future imports from the same source, so you only configure this once.

**Optional — source tag:** if you have multiple bank accounts, you can create a tag marked as
"source" (on the Tags page) and select it here. Every imported transaction will be tagged with
that source, making it easy to filter by account later.

### Preview

The preview table shows every row with a status badge:

- **New** — will be imported.
- **Duplicate (in DB)** — this exact file, mapping, and row position was already imported and will
  be skipped. Legitimate identical-looking rows at different positions are preserved.
- **Error** — missing date or name; will be skipped.

Verify the dates and amounts look correct, then click **Import**.

### Done

The summary screen shows how many rows were imported, skipped as duplicates, and errored. For the
sample file you should see **204 imported, 0 duplicates, 0 errors**.

---

## Step 5 — Tag transactions

After import, all 204 rows are in the database. The 168 expense (debit) transactions are
untagged and need to be categorised. The remaining 36 rows are payroll deposits from Work Co.
and Freelance.com — leave them untagged since income is tracked separately via the Income
Sources you set up in Step 3.

Tagging connects spending to your budget lines and makes the dashboard meaningful.

> **Navigate to** → **Transactions** in the sidebar.

### 5a — Manual tagging

Use the filter bar to find transactions by date range, description keyword, or amount. Click any
row to open the tag panel on the right, then select one or more tags from the dropdown and save.

Manual tagging is best for:

- One-off or unusual transactions.
- Transactions that require judgment (e.g., a pharmacy purchase that was actually a gift).
- Correcting a tag that the auto-tagger assigned incorrectly.

### 5b — Auto-tagging with rules

Auto-tag rules let you define patterns once and have the app tag matching transactions
automatically — including future imports.

> **Navigate to** → **Tags** in the sidebar → scroll to the **Auto-Tag Rules** section at the
> bottom of the page.

Click **Add Rule**. Each rule has:

- **Pattern** — the text to match against the _normalized_ transaction name.
- **Match type** — `Exact` or `Regex`.
- **Tag** — which tag to apply when the pattern matches.

#### When to use Exact match

Use **Exact** when the vendor name is always identical across transactions. The match is
case-insensitive and compares against the normalized name (punctuation stripped, extra spaces
removed).

Examples for the sample file:

| Pattern                           | Tag             |
| --------------------------------- | --------------- |
| `sunrise mortgage co`             | `Housing`       |
| `citygas and power`               | `Utilities`     |
| `netflix subscription`            | `Subscriptions` |
| `spotify subscription`            | `Subscriptions` |
| `amazon prime membership`         | `Subscriptions` |
| `savings transfer emergency fund` | `Savings`       |

#### When to use Regex match

Use **Regex** when the vendor name varies slightly between transactions — different locations,
reference numbers, or formatting. A regex pattern can match all of them at once.

Examples for the sample file:

| Pattern                                                       | Tag              | What it matches                            |
| ------------------------------------------------------------- | ---------------- | ------------------------------------------ |
| `freshmart`                                                   | `Groceries`      | "FreshMart Grocery", "FRESHMART #12", etc. |
| `whole foods`                                                 | `Groceries`      | Any Whole Foods transaction                |
| `shell gas`                                                   | `Transportation` | "Shell Gas Station", "SHELL GAS #45"       |
| `exxonmobil`                                                  | `Transportation` | "ExxonMobil Fuel", "EXXONMOBIL #7"         |
| `bella pasta\|maple street diner\|sakura sushi\|burger joint` | `Dining Out`     | All four restaurant vendors with one rule  |
| `amc cinemas\|steam gaming\|ticketmaster`                     | `Entertainment`  | Cinema, gaming, and event vendors          |
| `cvs pharmacy`                                                | `Health`         | CVS Pharmacy                               |
| `target store`                                                | `Shopping`       | Target Store                               |

> **Tip:** the single-rule approach with `|` (alternation) is powerful — one rule covers an
> entire vendor family. Use it when vendors belong to the same category and you don't need
> per-vendor granularity.

#### Run auto-tag

After adding rules, click **Auto-Tag** (on the Transactions page). The engine checks every untagged transaction against
your rules in order and applies matching tags. It also applies multiple rules to the same transaction — so if you have
both a `Dining Out` rule and an `Entertainment` rule, a transaction matching both gets both tags.

After running, most of the transactions should be tagged. Use the **Untagged** filter on the Transactions page to find
any that still need manual attention.

---

## Step 6 — Review transactions and dashboard

### Transactions page

Use the filter bar to audit your tagging:

- Filter by **tag** to see all transactions for a given category.
- Filter by **amount** to find unusually large purchases.
- Use the **search** field to find a specific vendor.

Correct any mis-tagged rows by clicking the row and updating the tags in the panel.

Transactions you want to hide from your reports permanently — such as the income deposits that
are already tracked via Income Sources — can be **archived**. Click any row and use the archive
icon that appears on the right side. Archived transactions are excluded from all filters, budget
calculations, and the dashboard. You can review or restore them at any time via **Archived** in
the sidebar.

### Dashboard

> **Navigate to** → **Dashboard** in the sidebar.

Use the **time period selector** at the top of the page to pick the month or range you want to
review.

#### Budget summary cards

The top of the page shows two rows of summary cards — one for the selected period and one for
the full calendar year. Click any card to open a panel showing the individual transactions
behind that number.

#### Expected Income

Shows yearly net income (scaled correctly for bi-weekly sources) and a per-source breakdown.
Use this to verify that your total planned income comfortably covers your total planned spending.

#### Budget Expenses

A table of every budget line showing its planned **Amount**, **Period**, and annualised
**Yearly Total**, plus columns for what percentage each line represents of your total yearly
budget and of your net income. This is a budget-allocation view — use it to check that your plan
is proportioned the way you intend.

### Budget page — untracked spending

> **Navigate to** → **Budget** in the sidebar → scroll to the **Untracked Spending** section.

This section shows tagged spending that has **no matching budget line** — in this walkthrough,
that means `Shopping` (Target Store transactions).

Click **Add Category** and create an untracked category called `Irregular Purchases`. Assign the
`Shopping` tag to it. Now instead of appearing as raw tagged transactions, Target Store spending
is grouped under a named category. Click the row to slide out individual transactions.

> **Why untracked instead of a budget line?** Because Target Store spending is irregular and
> unpredictable. A formal budget line with a planned amount would be misleading. Tracking it as
> an untracked category lets you monitor total spend without committing to a monthly target.

---

## Step 6.5 — Fine-tune a sample line item

Now that your data is imported and tagged, use the **Fine Tune** page to calibrate one real line against historical behavior.

> **Navigate to** → **Fine Tune** in the sidebar (or click the slider icon in a row on the **Budget** page).

For this walkthrough, use the **Dining & Entertainment** line (`Dining Out` + `Entertainment`) because it usually has variable month-to-month spending and is a good example of how suggestions react.

### 6.5a — Open and select the line

1. Open **Fine Tune**.
2. In **Budget Line**, select **Dining & Entertainment**.
3. Wait for the chart and stats to load.

You should see:

- A spending history bar chart by month.
- A dashed **Budget** reference line (monthly equivalent).
- A historical **Average** line and variability band.
- A fit indicator (green / yellow / red / insufficient).

### 6.5b — Read the baseline

Before changing anything, note these cards:

- **Avg/month (historical)**
- **Std deviation**
- **Variability**
- **Projected yearly budget** vs **Expected yearly (history)**

These tell you whether the current budget is already close to real spending.

### 6.5c — Try practical adjustments

Use this sequence to understand how each control behaves:

1. **Amount**: increase/decrease by ~$25–$50 and watch projected yearly + fit update immediately.
2. **Period**: switch between `monthly`, `biweekly`, and `yearly` and compare the monthly equivalent line on the chart.
3. **Rollover**: toggle on/off and review suggestion changes (useful for irregular categories).
4. **Tags**: temporarily remove `Entertainment`, then add it back. This re-runs analysis using only the selected tags so you can see how much each tag contributes.

### 6.5d — Use the fit and suggestions to decide

Interpretation guide:

- **Green fit**: budget is close to historical trend.
- **Yellow fit**: moderate mismatch; usually worth a small amount or period adjustment.
- **Red fit**: significant mismatch; likely under- or over-budgeted.
- **Insufficient**: not enough complete history yet.

Use **Insights & Suggestions** as prompts, not hard rules. A suggestion may be statistically true but still not match your intent (for example, planning extra buffer on purpose).

### 6.5e — Save (or revert)

- Click **Update Budget Line** to persist changes.
- Click **Cancel** to restore original values.

After saving, return to **Budget** to verify the updated line and fit marker in the table.

---

## Step 7 — Future steps

### Adjusting budget lines over time

Your spending patterns will shift. As months go by:

1. Review the **Expenses table** at the end of each month.
2. If a line is consistently over budget, increase the planned amount.
3. If a line is consistently under budget, reduce it to free up room elsewhere.
4. Add new lines for categories that appear in untracked spending and that you want to plan for.

Edit budget lines directly from the **Budget** page — changes take effect for subsequent periods
immediately.

### Creating a new budget when your plan changes significantly

A single budget can be adjusted incrementally forever, but sometimes a bigger life change
(new job, moving, having a child) warrants a clean break. The workflow is:

1. Go to **Manage Budgets** and click **Copy** on your current budget.
2. Give the copy a new name and set its start date to the month the change takes effect.
3. Edit the copied budget's lines to reflect your new plan.

The original budget is preserved intact and will still be used for the dashboard when you browse
periods before the new budget's start date. Your full financial history remains correct and
searchable.

### Importing real bank statements

Once you're comfortable with the sample data:

1. Export a CSV from your bank (usually under _Statements_ or _Download transactions_).
2. Go to **Import** and upload the file.
3. Select or create a column mapping for your bank's format.
4. Your previously saved auto-tag rules will fire automatically.
5. Review remaining untagged transactions manually.

Repeat monthly. Re-importing the exact same statement with the same mapping is safe and is skipped
by a file-and-row import key. Separate identical-looking transactions are not discarded.
