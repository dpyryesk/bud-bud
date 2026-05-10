-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "debit" REAL NOT NULL DEFAULT 0,
    "credit" REAL NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "csvHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Transaction" ("createdAt", "credit", "csvHash", "date", "debit", "id", "name", "normalizedName", "notes", "source", "updatedAt") SELECT "createdAt", "credit", "csvHash", "date", "debit", "id", "name", "normalizedName", "notes", "source", "updatedAt" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_csvHash_key" ON "Transaction"("csvHash");
CREATE INDEX "Transaction_normalizedName_idx" ON "Transaction"("normalizedName");
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_archived_idx" ON "Transaction"("archived");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
