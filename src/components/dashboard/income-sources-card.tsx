'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, getYearlyAmount } from '@/lib/date-utils';
import type { IncomeSource } from '@/types';

interface IncomeSourcesCardProps {
  incomeSources: IncomeSource[];
}

const PERIOD_LABEL: Record<string, string> = {
  monthly: 'Monthly',
  biweekly: 'Bi-weekly',
  yearly: 'Yearly',
};

export function IncomeSourcesCard({ incomeSources }: IncomeSourcesCardProps) {
  const hasGross = incomeSources.some((s) => s.grossAmount !== null);
  const totalYearlyNet = incomeSources.reduce(
    (sum, s) => sum + getYearlyAmount(s.netAmount, s.netPeriod),
    0,
  );
  const totalYearlyGross = incomeSources
    .filter((s) => s.grossAmount !== null)
    .reduce((sum, s) => sum + getYearlyAmount(s.grossAmount!, s.grossPeriod ?? s.netPeriod), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expected Income</CardTitle>
      </CardHeader>
      <CardContent>
        {incomeSources.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No income sources configured. Add them on the Budget page.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pr-4 pb-2 font-medium">Name</th>
                  <th className="pr-4 pb-2 font-medium">Net Amount</th>
                  <th className="pr-4 pb-2 font-medium">Period</th>
                  <th className="pr-4 pb-2 font-medium">Yearly Net</th>
                  {hasGross && (
                    <>
                      <th className="pr-4 pb-2 font-medium">Gross Amount</th>
                      <th className="pr-4 pb-2 font-medium">Period</th>
                      <th className="pr-4 pb-2 font-medium">Yearly Gross</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {incomeSources.map((source) => (
                  <tr key={source.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{source.name}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatCurrency(source.netAmount)}</td>
                    <td className="py-2 pr-4">
                      {PERIOD_LABEL[source.netPeriod] ?? source.netPeriod}
                    </td>
                    <td className="py-2 pr-4 font-medium tabular-nums">
                      {formatCurrency(getYearlyAmount(source.netAmount, source.netPeriod))}
                    </td>
                    {hasGross && (
                      <>
                        <td className="py-2 pr-4 tabular-nums">
                          {source.grossAmount !== null ? formatCurrency(source.grossAmount) : '—'}
                        </td>
                        <td className="py-2 pr-4">
                          {source.grossPeriod
                            ? (PERIOD_LABEL[source.grossPeriod] ?? source.grossPeriod)
                            : '—'}
                        </td>
                        <td className="py-2 pr-4 font-medium tabular-nums">
                          {source.grossAmount !== null
                            ? formatCurrency(
                                getYearlyAmount(
                                  source.grossAmount,
                                  source.grossPeriod ?? source.netPeriod,
                                ),
                              )
                            : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="bg-muted/30 font-semibold">
                  <td className="py-2 pr-4">Total</td>
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4" />
                  <td className="py-2 pr-4 tabular-nums">{formatCurrency(totalYearlyNet)}</td>
                  {hasGross && (
                    <>
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4" />
                      <td className="py-2 pr-4 tabular-nums">{formatCurrency(totalYearlyGross)}</td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
