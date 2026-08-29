PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Money is stored as integer cents. ROUND preserves the nearest cent from the
-- previous REAL values without changing any public API dollar amounts.
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "debit" INTEGER NOT NULL DEFAULT 0 CHECK ("debit" >= 0),
    "credit" INTEGER NOT NULL DEFAULT 0 CHECK ("credit" >= 0),
    "source" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "csvHash" TEXT NOT NULL,
    "importKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Transaction" (
    "id", "date", "name", "normalizedName", "debit", "credit", "source", "notes",
    "archived", "csvHash", "importKey", "createdAt", "updatedAt"
)
SELECT
    "id", "date", "name", "normalizedName",
    CAST(ROUND("debit" * 100) AS INTEGER),
    CAST(ROUND("credit" * 100) AS INTEGER),
    "source", "notes", "archived", "csvHash", NULL, "createdAt", "updatedAt"
FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_importKey_key" ON "Transaction"("importKey");
CREATE INDEX "Transaction_csvHash_idx" ON "Transaction"("csvHash");
CREATE INDEX "Transaction_normalizedName_idx" ON "Transaction"("normalizedName");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_archived_idx" ON "Transaction"("archived");

CREATE UNIQUE INDEX "BudgetCategory_id_budgetId_key" ON "BudgetCategory"("id", "budgetId");

CREATE TABLE "new_BudgetLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "period" TEXT NOT NULL CHECK ("period" IN ('monthly', 'biweekly', 'yearly')),
    "amount" INTEGER NOT NULL CHECK ("amount" >= 0),
    "rollover" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0 CHECK ("order" >= 0),
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BudgetLine_categoryId_budgetId_fkey" FOREIGN KEY ("categoryId", "budgetId") REFERENCES "BudgetCategory" ("id", "budgetId") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_BudgetLine" (
    "id", "name", "period", "amount", "rollover", "order", "budgetId", "categoryId",
    "createdAt", "updatedAt"
)
SELECT
    bl."id", bl."name", bl."period", CAST(ROUND(bl."amount" * 100) AS INTEGER),
    bl."rollover", MAX(bl."order", 0), bl."budgetId",
    CASE
      WHEN bl."categoryId" IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1 FROM "BudgetCategory" bc
        WHERE bc."id" = bl."categoryId" AND bc."budgetId" = bl."budgetId"
      ) THEN bl."categoryId"
      ELSE NULL
    END,
    bl."createdAt", bl."updatedAt"
FROM "BudgetLine" bl;
DROP TABLE "BudgetLine";
ALTER TABLE "new_BudgetLine" RENAME TO "BudgetLine";
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");
CREATE INDEX "BudgetLine_categoryId_budgetId_idx" ON "BudgetLine"("categoryId", "budgetId");

CREATE TABLE "new_IncomeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "netAmount" INTEGER NOT NULL CHECK ("netAmount" >= 0),
    "netPeriod" TEXT NOT NULL CHECK ("netPeriod" IN ('monthly', 'biweekly', 'yearly')),
    "grossAmount" INTEGER CHECK ("grossAmount" IS NULL OR "grossAmount" >= 0),
    "grossPeriod" TEXT CHECK ("grossPeriod" IS NULL OR "grossPeriod" IN ('monthly', 'biweekly', 'yearly')),
    "order" INTEGER NOT NULL DEFAULT 0 CHECK ("order" >= 0),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeSource_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IncomeSource" (
    "id", "budgetId", "name", "netAmount", "netPeriod", "grossAmount", "grossPeriod",
    "order", "createdAt", "updatedAt"
)
SELECT
    "id", "budgetId", "name", CAST(ROUND("netAmount" * 100) AS INTEGER), "netPeriod",
    CASE WHEN "grossAmount" IS NULL THEN NULL ELSE CAST(ROUND("grossAmount" * 100) AS INTEGER) END,
    "grossPeriod", MAX("order", 0), "createdAt", "updatedAt"
FROM "IncomeSource";
DROP TABLE "IncomeSource";
ALTER TABLE "new_IncomeSource" RENAME TO "IncomeSource";
CREATE INDEX "IncomeSource_budgetId_idx" ON "IncomeSource"("budgetId");

CREATE INDEX "Tag_parentId_idx" ON "Tag"("parentId");
CREATE INDEX "TransactionTag_tagId_idx" ON "TransactionTag"("tagId");
CREATE INDEX "BudgetCategory_budgetId_idx" ON "BudgetCategory"("budgetId");
CREATE INDEX "BudgetLineTag_tagId_idx" ON "BudgetLineTag"("tagId");
CREATE INDEX "CsvMapping_sourceTagId_idx" ON "CsvMapping"("sourceTagId");
CREATE INDEX "AutoTagRule_tagId_idx" ON "AutoTagRule"("tagId");
CREATE INDEX "UntrackedCategory_budgetId_idx" ON "UntrackedCategory"("budgetId");
CREATE INDEX "UntrackedCategoryTag_tagId_idx" ON "UntrackedCategoryTag"("tagId");

CREATE TRIGGER "AutoTagRule_validate_matchType_insert"
BEFORE INSERT ON "AutoTagRule"
WHEN NEW."matchType" NOT IN ('exact', 'regex')
BEGIN
  SELECT RAISE(ABORT, 'invalid AutoTagRule matchType');
END;
CREATE TRIGGER "AutoTagRule_validate_matchType_update"
BEFORE UPDATE OF "matchType" ON "AutoTagRule"
WHEN NEW."matchType" NOT IN ('exact', 'regex')
BEGIN
  SELECT RAISE(ABORT, 'invalid AutoTagRule matchType');
END;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
