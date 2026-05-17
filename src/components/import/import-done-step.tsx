import { AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ImportResult } from '@/types';

interface ImportDoneStepProps {
  result: ImportResult;
  onReset: () => void;
}

const RESULT_STATS = (result: ImportResult) =>
  [
    { label: 'Total Rows', value: result.total, color: '' },
    { label: 'Imported', value: result.imported, color: 'text-green-600' },
    { label: 'Duplicates Skipped', value: result.duplicates, color: 'text-yellow-600' },
    {
      label: 'Errors',
      value: result.errors,
      color: result.errors > 0 ? 'text-red-600' : 'text-muted-foreground',
    },
  ] as const;

export default function ImportDoneStep({ result, onReset }: ImportDoneStepProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Import Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {RESULT_STATS(result).map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-muted-foreground text-sm">{label}</p>
              </div>
            ))}
          </div>

          {result.errors > 0 && (
            <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {result.errors} row{result.errors !== 1 ? 's' : ''} could not be imported due to parse
              errors.
            </div>
          )}

          {result.imported > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/20 dark:text-green-400">
              <Check className="h-4 w-4 shrink-0" />
              Successfully imported {result.imported} transaction
              {result.imported !== 1 ? 's' : ''}. You can view them in the Transactions tab.
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={onReset} variant="outline" className="w-full">
        Import Another File
      </Button>
    </>
  );
}
