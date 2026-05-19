'use client';

import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  type TooltipContentProps,
} from 'recharts';
import { formatCurrency } from '@/lib/date-utils';
import type { FineTuneMonthlyDataPoint, FineTuneStats } from '@/types';
import type { BudgetPeriodType } from '@/lib/date-utils';
import { calcMonthlyEquivalent, formatMonthKeyShort, formatMonthKeyLong } from './constants';

interface SpendingHistoryChartProps {
  monthlyData: FineTuneMonthlyDataPoint[];
  stats: FineTuneStats;
  draftAmount: number;
  draftPeriod: BudgetPeriodType;
}

function CustomTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  // `budget` and `average` are data fields but not chart series (they are ReferenceLine values),
  // so they won't appear in `payload` by dataKey — read from the raw datum instead.
  const datum = payload[0]?.payload as
    | { spending?: number; budget?: number; average?: number }
    | undefined;
  const spending = datum?.spending ?? 0;
  const budget = datum?.budget ?? 0;
  const avg = datum?.average ?? 0;

  const monthLabel = formatMonthKeyLong(String(label ?? '')) || String(label ?? '');

  return (
    <div className="bg-popover border-border rounded-lg border p-3 text-sm shadow-lg">
      <p className="font-semibold">{monthLabel}</p>
      <div className="mt-1 space-y-0.5">
        <p>
          <span className="text-muted-foreground">Spending: </span>
          <span className="font-medium text-amber-600">{formatCurrency(Number(spending))}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Budget/mo: </span>
          <span className="font-medium text-green-600">{formatCurrency(Number(budget))}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Average: </span>
          <span className="font-medium text-blue-600">{formatCurrency(Number(avg))}</span>
        </p>
        {Number(avg) > 0 && (
          <p>
            <span className="text-muted-foreground">vs avg: </span>
            <span
              className={
                Number(spending) > Number(avg)
                  ? 'font-medium text-red-500'
                  : 'font-medium text-green-500'
              }
            >
              {Number(spending) > Number(avg) ? '+' : ''}
              {formatCurrency(Number(spending) - Number(avg))}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export function SpendingHistoryChart({
  monthlyData,
  stats,
  draftAmount,
  draftPeriod,
}: SpendingHistoryChartProps) {
  const monthlyBudget = calcMonthlyEquivalent(draftAmount, draftPeriod);
  const { average, stdDev } = stats;
  const bandLow = Math.max(0, average - stdDev);
  const bandHigh = average + stdDev;

  // Recharts requires the full data series with constant reference values baked in
  const chartData = monthlyData.map((d) => ({
    month: d.month,
    spending: d.spending,
    budget: monthlyBudget,
    average,
    transactionCount: d.transactionCount,
  }));

  const formatXAxis = (value: string) => formatMonthKeyShort(value) || value;

  const formatYAxis = (value: number) => {
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
    return `$${value.toFixed(0)}`;
  };

  if (monthlyData.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
        No spending data available for the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="month"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <YAxis
          tickFormatter={formatYAxis}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
        />
        <Tooltip content={(props) => <CustomTooltip {...props} />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => {
            const labels: Record<string, string> = {
              spending: 'Actual spending',
              budget: 'Budget (monthly equiv.)',
              average: 'Historical average',
            };
            return labels[value] ?? value;
          }}
        />

        {/* ±1 std dev band */}
        {stats.monthCount >= 2 && stdDev > 0 && (
          <ReferenceArea
            y1={bandLow}
            y2={bandHigh}
            fill="#3b82f6"
            fillOpacity={0.08}
            label={{ value: '±1σ', position: 'insideTopRight', fontSize: 10, fill: '#3b82f6' }}
          />
        )}

        {/* Actual spending bars */}
        <Bar dataKey="spending" fill="#d97706" radius={[2, 2, 0, 0]} maxBarSize={40} />

        {/* Average reference line */}
        {stats.monthCount >= 1 && (
          <ReferenceLine
            y={average}
            stroke="#3b82f6"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            label={{ value: 'Avg', position: 'insideTopLeft', fontSize: 10, fill: '#3b82f6' }}
          />
        )}

        {/* Monthly budget equivalent reference line */}
        <ReferenceLine
          y={monthlyBudget}
          stroke="#16a34a"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          label={{ value: 'Budget', position: 'insideTopRight', fontSize: 10, fill: '#16a34a' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
