'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TagBadge } from '@/components/tags/tag-badge';
import { formatCurrency, formatIsoDateForDisplay } from '@/lib/date-utils';
import type { TransactionWithTags } from '@/types';

interface FineTuneTransactionsTableProps {
  transactions: TransactionWithTags[];
  budgetLineName: string;
  analysisStartDate: string;
}

export function FineTuneTransactionsTable({
  transactions,
  budgetLineName,
  analysisStartDate,
}: FineTuneTransactionsTableProps) {
  const totalDebit = transactions.reduce((s, tx) => s + tx.debit, 0);
  const totalCredit = transactions.reduce((s, tx) => s + tx.credit, 0);

  const formattedStart = new Date(analysisStartDate).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Transactions — {budgetLineName}</CardTitle>
          <span className="text-muted-foreground text-xs">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} since{' '}
            {formattedStart}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-b-lg border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-28 text-right">Debit</TableHead>
                <TableHead className="w-28 text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                    No transactions found for this budget line since {formattedStart}.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const categoryTags = tx.tags.filter((t) => !t.isSource);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatIsoDateForDisplay(tx.date, 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="max-w-[260px]">
                        <span className="block truncate font-medium" title={tx.name}>
                          {tx.name}
                        </span>
                        {tx.notes && (
                          <span className="text-muted-foreground block truncate text-xs">
                            {tx.notes}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {categoryTags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {categoryTags.map((t) => (
                              <TagBadge
                                key={t.id}
                                name={t.name}
                                color={t.color}
                                className="text-xs"
                              />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.debit > 0 ? formatCurrency(tx.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tx.credit > 0 ? (
                          <span className="text-green-600 dark:text-green-400">
                            +{formatCurrency(tx.credit)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer totals */}
        {transactions.length > 0 && (
          <div className="flex items-center justify-end gap-6 border-t px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total spent</span>
              <span className="font-semibold tabular-nums">{formatCurrency(totalDebit)}</span>
            </div>
            {totalCredit > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Total received</span>
                <span className="font-semibold text-green-600 tabular-nums dark:text-green-400">
                  +{formatCurrency(totalCredit)}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
