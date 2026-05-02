import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface BudgetSummaryCardsProps {
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  totalUntracked: number;
  totalIncome: number;
  totalDebits: number;
}

export function BudgetSummaryCards({
  totalBudget,
  totalActual,
  totalRemaining,
  totalUntracked,
  totalIncome,
  totalDebits,
}: BudgetSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalDebits)}</div>
          <p className="text-muted-foreground mt-1 text-xs">Sum of all debits</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tracked Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
          <p className="text-muted-foreground mt-1 text-xs">Across budget lines</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Remaining</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              'text-2xl font-bold',
              totalRemaining >= 0 ? 'text-green-600' : 'text-red-600',
            )}
          >
            {formatCurrency(totalRemaining)}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Untracked Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={cn('text-2xl font-bold', totalUntracked > 0 ? 'text-amber-600' : '')}>
            {formatCurrency(totalUntracked)}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">No budget line assigned</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalIncome)}</div>
          <p className="text-muted-foreground mt-1 text-xs">Sum of all credits</p>
        </CardContent>
      </Card>
    </div>
  );
}
