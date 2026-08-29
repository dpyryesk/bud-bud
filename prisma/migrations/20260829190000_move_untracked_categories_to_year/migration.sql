PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Materialize every calendar year in which each budget was applicable. When
-- the next revision starts midyear, both configurations belong to that year.
-- The latest budget is carried through the latest transaction year or the
-- migration year, whichever is later.
CREATE TEMP TABLE "_UntrackedCategoryCandidate" AS
WITH RECURSIVE
"MaximumYear"("year") AS (
    SELECT MAX(
        CAST(strftime('%Y', 'now') AS INTEGER),
        COALESCE((SELECT MAX(CAST(strftime('%Y', "date") AS INTEGER)) FROM "Transaction"), 1900),
        COALESCE((SELECT MAX(CAST(strftime('%Y', "startDate") AS INTEGER)) FROM "Budget"), 1900)
    )
),
"OrderedBudget" AS (
    SELECT
        "id",
        "startDate",
        LEAD("startDate") OVER (ORDER BY "startDate") AS "nextStartDate"
    FROM "Budget"
),
"BudgetPeriod" AS (
    SELECT
        "id" AS "budgetId",
        CAST(strftime('%Y', "startDate") AS INTEGER) AS "startYear",
        CASE
            WHEN "nextStartDate" IS NULL THEN (SELECT "year" FROM "MaximumYear")
            WHEN strftime('%m-%d', "nextStartDate") = '01-01'
                THEN CAST(strftime('%Y', "nextStartDate") AS INTEGER) - 1
            ELSE CAST(strftime('%Y', "nextStartDate") AS INTEGER)
        END AS "endYear"
    FROM "OrderedBudget"
),
"BudgetYear"("budgetId", "startYear", "year", "endYear") AS (
    SELECT "budgetId", "startYear", "startYear", MAX("startYear", "endYear")
    FROM "BudgetPeriod"
    UNION ALL
    SELECT "budgetId", "startYear", "year" + 1, "endYear"
    FROM "BudgetYear"
    WHERE "year" < "endYear"
)
SELECT
    uc."id" AS "oldCategoryId",
    CASE
        WHEN byear."year" = byear."startYear" THEN uc."id"
        ELSE uc."id" || '__year_' || byear."year"
    END AS "candidateId",
    byear."year" AS "year",
    uc."name" AS "name",
    uc."order" AS "order",
    uc."createdAt" AS "createdAt",
    uc."updatedAt" AS "updatedAt",
    COALESCE((
        SELECT GROUP_CONCAT("tagId", ',')
        FROM (
            SELECT uct."tagId"
            FROM "UntrackedCategoryTag" uct
            WHERE uct."untrackedCategoryId" = uc."id"
            ORDER BY uct."tagId"
        )
    ), '') AS "tagSignature"
FROM "UntrackedCategory" uc
JOIN "BudgetYear" byear ON byear."budgetId" = uc."budgetId";

-- Map equivalent copies in the same year to one stable category. Equivalence
-- requires the same name and the exact same sorted tag set.
CREATE TEMP TABLE "_UntrackedCategoryMap" AS
SELECT
    candidate.*,
    (
        SELECT MIN(equivalent."candidateId")
        FROM "_UntrackedCategoryCandidate" equivalent
        WHERE equivalent."year" = candidate."year"
          AND equivalent."name" = candidate."name"
          AND equivalent."tagSignature" = candidate."tagSignature"
    ) AS "canonicalId"
FROM "_UntrackedCategoryCandidate" candidate;

CREATE TABLE "new_UntrackedCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1900 AND 9999),
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_UntrackedCategory" ("id", "year", "name", "order", "createdAt", "updatedAt")
SELECT
    "canonicalId",
    "year",
    "name",
    MIN("order"),
    MIN("createdAt"),
    MAX("updatedAt")
FROM "_UntrackedCategoryMap"
GROUP BY "canonicalId", "year", "name";

CREATE TABLE "new_UntrackedCategoryTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "untrackedCategoryId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    CONSTRAINT "UntrackedCategoryTag_untrackedCategoryId_fkey"
        FOREIGN KEY ("untrackedCategoryId") REFERENCES "new_UntrackedCategory" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UntrackedCategoryTag_tagId_fkey"
        FOREIGN KEY ("tagId") REFERENCES "Tag" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_UntrackedCategoryTag" ("id", "untrackedCategoryId", "tagId")
SELECT DISTINCT
    mapping."canonicalId" || ':' || oldTag."tagId",
    mapping."canonicalId",
    oldTag."tagId"
FROM "_UntrackedCategoryMap" mapping
JOIN "UntrackedCategoryTag" oldTag
  ON oldTag."untrackedCategoryId" = mapping."oldCategoryId";

DROP TABLE "UntrackedCategoryTag";
DROP TABLE "UntrackedCategory";
ALTER TABLE "new_UntrackedCategory" RENAME TO "UntrackedCategory";
ALTER TABLE "new_UntrackedCategoryTag" RENAME TO "UntrackedCategoryTag";

CREATE INDEX "UntrackedCategory_year_idx" ON "UntrackedCategory"("year");
CREATE UNIQUE INDEX "UntrackedCategoryTag_untrackedCategoryId_tagId_key"
    ON "UntrackedCategoryTag"("untrackedCategoryId", "tagId");
CREATE INDEX "UntrackedCategoryTag_tagId_idx" ON "UntrackedCategoryTag"("tagId");

DROP TABLE "_UntrackedCategoryMap";
DROP TABLE "_UntrackedCategoryCandidate";

PRAGMA foreign_keys=ON;
