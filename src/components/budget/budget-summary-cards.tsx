import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

interface BudgetSummaryCardsProps {
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
}

export function BudgetSummaryCards({
  totalBudget,
  totalActual,
  totalRemaining,
}: BudgetSummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
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
          <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
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
    </div>
  );
}
