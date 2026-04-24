'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTimePeriod } from '@/hooks/use-time-period';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeftRight, DollarSign, TrendingDown, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/date-utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import Link from 'next/link';

type DashboardData = {
  totalIncome: number;
  totalSpending: number;
  net: number;
  count: number;
  spendingByTag: { name: string; color: string; amount: number }[];
};

export default function DashboardPage() {
  const { period } = useTimePeriod();
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({
      start: period.start.toISOString(),
      end: period.end.toISOString(),
    });
    const res = await fetch(`/api/dashboard?${params}`);
    setData(await res.json());
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Showing data for: {period.label}</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data?.totalIncome ?? 0)}
            </div>
            <p className="text-muted-foreground text-xs">Credits for the period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Spending</CardTitle>
            <TrendingDown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data?.totalSpending ?? 0)}</div>
            <p className="text-muted-foreground text-xs">Debits for the period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${(data?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {formatCurrency(data?.net ?? 0)}
            </div>
            <p className="text-muted-foreground text-xs">Income minus spending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowLeftRight className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.count ?? 0}</div>
            <p className="text-muted-foreground text-xs">Total for the period</p>
          </CardContent>
        </Card>
      </div>

      {data?.spendingByTag && data.spendingByTag.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Spending by Tag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.spendingByTag}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) =>
                      `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {data.spendingByTag.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => formatCurrency(value as number)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center">
          <p>Import some transactions to get started!</p>
          <p className="mt-1 text-sm">
            Go to{' '}
            <Link href="/import" className="text-primary underline">
              Import
            </Link>{' '}
            to upload a CSV file from your bank.
          </p>
        </div>
      )}
    </div>
  );
}
