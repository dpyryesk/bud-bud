-- CreateTable
CREATE TABLE "IncomeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "netAmount" REAL NOT NULL,
    "netPeriod" TEXT NOT NULL,
    "grossAmount" REAL,
    "grossPeriod" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeSource_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UntrackedCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UntrackedCategory_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UntrackedCategoryTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "untrackedCategoryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "UntrackedCategoryTag_untrackedCategoryId_fkey" FOREIGN KEY ("untrackedCategoryId") REFERENCES "UntrackedCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UntrackedCategoryTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "UntrackedCategoryTag_untrackedCategoryId_tagId_key" ON "UntrackedCategoryTag"("untrackedCategoryId", "tagId");
