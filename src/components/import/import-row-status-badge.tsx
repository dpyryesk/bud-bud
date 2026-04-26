'use client';

import type { ParsedTransaction } from '@/types';
import { Badge } from '@/components/ui/badge';

export default function RowStatusBadge({ row }: { row: ParsedTransaction }) {
  if (row.error) {
    return (
      <Badge variant="destructive" className="text-xs">
        Error
      </Badge>
    );
  }
  if (row.isDuplicateInDb) {
    return (
      <Badge className="bg-yellow-100 text-xs text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900 dark:text-yellow-200">
        Duplicate
      </Badge>
    );
  }
  if (row.isDuplicateInCsv) {
    return (
      <Badge className="bg-orange-100 text-xs text-orange-800 hover:bg-orange-100 dark:bg-orange-900 dark:text-orange-200">
        CSV Dup
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-xs text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-200">
      New
    </Badge>
  );
}
