import {
  DollarSign,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ArrowDownCircle,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { SummaryCardType } from '@/components/dashboard/summary-transactions-panel';

interface BudgetSummaryCardsProps {
  totalBudget: number;
  totalActual: number;
  totalRemaining: number;
  totalUntracked: number;
  totalIncome: number;
  totalDebits: number;
  onCardClick?: (type: SummaryCardType) => void;
}

interface SummaryCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  valueClassName?: string;
  onClick?: () => void;
}

function SummaryCard({ title, value, subtitle, icon, valueClassName, onClick }: SummaryCardProps) {
  return (
    <Card
      className={cn(onClick && 'cursor-pointer transition-shadow hover:shadow-md')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
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
  onCardClick,
}: BudgetSummaryCardsProps) {
  const netBalance = totalIncome - totalDebits;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
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
        onClick={onCardClick ? () => onCardClick('total-spending') : undefined}
      />
      <SummaryCard
        title="Tracked Spending"
        value={formatCurrency(totalActual)}
        subtitle="Across budget lines"
        icon={<CheckCircle2 className="h-4 w-4" />}
        onClick={onCardClick ? () => onCardClick('tracked-spending') : undefined}
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
        onClick={onCardClick ? () => onCardClick('untracked-spending') : undefined}
      />
      <SummaryCard
        title="Total Income"
        value={formatCurrency(totalIncome)}
        subtitle="Sum of all credits"
        icon={<ArrowDownCircle className="text-primary h-4 w-4" />}
        valueClassName="text-primary"
        onClick={onCardClick ? () => onCardClick('total-income') : undefined}
      />
      <SummaryCard
        title="Net Balance"
        value={formatCurrency(netBalance)}
        subtitle="Income minus spending"
        icon={
          netBalance >= 0 ? (
            <Scale className="text-primary h-4 w-4" />
          ) : (
            <Scale className="text-destructive h-4 w-4" />
          )
        }
        valueClassName={netBalance >= 0 ? 'text-primary' : 'text-destructive'}
      />
    </div>
  );
}
