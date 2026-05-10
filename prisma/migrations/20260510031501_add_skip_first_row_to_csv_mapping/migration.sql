-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CsvMapping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "dateColumn" TEXT NOT NULL,
    "nameColumn" TEXT NOT NULL,
    "debitColumn" TEXT NOT NULL,
    "creditColumn" TEXT NOT NULL,
    "sourceColumn" TEXT NOT NULL DEFAULT '',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "skipFirstRow" BOOLEAN NOT NULL DEFAULT false,
    "sourceTagId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CsvMapping_sourceTagId_fkey" FOREIGN KEY ("sourceTagId") REFERENCES "Tag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CsvMapping" ("createdAt", "creditColumn", "dateColumn", "dateFormat", "debitColumn", "id", "name", "nameColumn", "sourceColumn", "sourceTagId") SELECT "createdAt", "creditColumn", "dateColumn", "dateFormat", "debitColumn", "id", "name", "nameColumn", "sourceColumn", "sourceTagId" FROM "CsvMapping";
DROP TABLE "CsvMapping";
ALTER TABLE "new_CsvMapping" RENAME TO "CsvMapping";
CREATE UNIQUE INDEX "CsvMapping_name_key" ON "CsvMapping"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
