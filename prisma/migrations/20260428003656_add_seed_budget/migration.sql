INSERT INTO Budget (id, startDate, resetRollover, createdAt, updatedAt)
VALUES ('default-budget-seed', '2000-01-01 00:00:00.000', 0, datetime('now'), datetime('now'));

UPDATE BudgetCategory SET budgetId = 'default-budget-seed' WHERE budgetId IS NULL;
UPDATE BudgetLine SET budgetId = 'default-budget-seed' WHERE budgetId IS NULL;
