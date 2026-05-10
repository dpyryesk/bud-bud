import { Archive } from 'lucide-react';
import { ArchivedTransactionsTable } from '@/components/transactions/archived-transactions-table';

export const metadata = { title: 'Archived Transactions' };

export default function ArchivedTransactionsPage() {
  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Archive className="text-muted-foreground h-5 w-5" />
        <h1 className="text-xl font-semibold">Archived Transactions</h1>
      </div>
      <p className="text-muted-foreground text-sm">
        Archived transactions are excluded from all budget calculations and reports. Restore them to
        include them again.
      </p>
      <ArchivedTransactionsTable />
    </div>
  );
}
