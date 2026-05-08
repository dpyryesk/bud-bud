import {
  DollarSign,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowDownCircle,
} from 'lucide-react';
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

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  valueClassName?: string;
}

function SummaryCard({ title, value, subtitle, icon, valueClassName }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {title}
          </CardTitle>
          <span className="text-muted-foreground/60">{icon}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold tabular-nums', valueClassName)}>{value}</div>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  );
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
      <SummaryCard
        title="Total Budget"
        value={formatCurrency(totalBudget)}
        icon={<DollarSign className="h-4 w-4" />}
      />
      <SummaryCard
        title="Total Spending"
        value={formatCurrency(totalDebits)}
        subtitle="Sum of all debits"
        icon={<CreditCard className="h-4 w-4" />}
      />
      <SummaryCard
        title="Tracked Spending"
        value={formatCurrency(totalActual)}
        subtitle="Across budget lines"
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      <SummaryCard
        title="Remaining"
        value={formatCurrency(totalRemaining)}
        icon={
          totalRemaining >= 0 ? (
            <TrendingUp className="text-primary h-4 w-4" />
          ) : (
            <TrendingDown className="text-destructive h-4 w-4" />
          )
        }
        valueClassName={totalRemaining >= 0 ? 'text-primary' : 'text-destructive'}
      />
      <SummaryCard
        title="Untracked Spending"
        value={formatCurrency(totalUntracked)}
        subtitle="No budget line assigned"
        icon={<AlertCircle className={cn('h-4 w-4', totalUntracked > 0 ? 'text-amber-500' : '')} />}
        valueClassName={totalUntracked > 0 ? 'text-amber-600' : ''}
      />
      <SummaryCard
        title="Total Income"
        value={formatCurrency(totalIncome)}
        subtitle="Sum of all credits"
        icon={<ArrowDownCircle className="text-primary h-4 w-4" />}
        valueClassName="text-primary"
      />
    </div>
  );
}
