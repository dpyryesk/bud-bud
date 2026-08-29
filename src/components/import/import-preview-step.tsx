import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ImportPreview } from '@/types';
import RowStatusBadge from '@/components/import/import-row-status-badge';
import type { SourceTag } from '@/components/import/constants';

interface ImportPreviewStepProps {
  preview: ImportPreview;
  sourceValueTagMap: Record<string, string>;
  sourceTags: SourceTag[];
  importing: boolean;
  onBack: () => void;
  onImport: () => void;
}

const SUMMARY_STATS = (preview: ImportPreview) =>
  [
    { label: 'Total Rows', value: preview.total, color: '' },
    { label: 'New', value: preview.newCount, color: 'text-green-600' },
    { label: 'Duplicates', value: preview.duplicates, color: 'text-yellow-600' },
    { label: 'Errors', value: preview.errors, color: 'text-red-600' },
  ] as const;

type TabKey = 'all' | 'new' | 'duplicates' | 'errors';

const buildTabDefs = (preview: ImportPreview) => {
  const defs: { key: TabKey; label: string }[] = [
    { key: 'all', label: `All (${preview.total})` },
    { key: 'new', label: `New (${preview.newCount})` },
    { key: 'duplicates', label: `Duplicates (${preview.duplicates})` },
  ];
  if (preview.errors > 0) {
    defs.push({ key: 'errors', label: `Errors (${preview.errors})` });
  }
  return defs;
};

const filterRows = (rows: ImportPreview['rows'], tab: TabKey) => {
  if (tab === 'all') return rows;
  if (tab === 'new') return rows.filter((r) => !r.error && !r.isDuplicate);
  if (tab === 'duplicates') return rows.filter((r) => !r.error && r.isDuplicate);
  if (tab === 'errors') return rows.filter((r) => !!r.error);
  return rows;
};

export default function ImportPreviewStep({
  preview,
  sourceValueTagMap,
  sourceTags,
  importing,
  onBack,
  onImport,
}: ImportPreviewStepProps) {
  const hasSourceColumn = preview.rows.some((r) => r.source);
  const tabDefs = buildTabDefs(preview);
  const sourceValueTagFor = (source: string) => {
    const tagId = sourceValueTagMap[source];
    return tagId ? sourceTags.find((tag) => tag.id === tagId) : undefined;
  };

  return (
    <>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUMMARY_STATS(preview).map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-muted-foreground text-xs">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList className="mb-4 h-auto flex-wrap gap-1">
              {tabDefs.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {tabDefs.map(({ key: tab }) => {
              const rows = filterRows(preview.rows, tab);

              return (
                <TabsContent key={tab} value={tab}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">Status</TableHead>
                          <TableHead className="w-28">Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="w-28 text-right">Debit</TableHead>
                          <TableHead className="w-28 text-right">Credit</TableHead>
                          {hasSourceColumn && <TableHead>Source</TableHead>}
                          {hasSourceColumn && <TableHead>Source Value Tags</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={hasSourceColumn ? 7 : 5}
                              className="text-muted-foreground py-10 text-center"
                            >
                              No rows in this category
                            </TableCell>
                          </TableRow>
                        ) : (
                          rows.map((row, i) => (
                            <TableRow
                              key={i}
                              className={
                                row.error
                                  ? 'bg-red-50 dark:bg-red-950/20'
                                  : row.isDuplicate
                                    ? 'bg-yellow-50 dark:bg-yellow-950/20'
                                    : ''
                              }
                            >
                              <TableCell>
                                <RowStatusBadge row={row} />
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {row.date || '—'}
                              </TableCell>
                              <TableCell className="max-w-xs">
                                <span
                                  className={`block truncate text-sm ${row.error ? 'text-destructive italic' : ''}`}
                                  title={row.error || row.name}
                                >
                                  {row.error ? row.error : row.name}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {row.debit > 0 ? `$${row.debit.toFixed(2)}` : '—'}
                              </TableCell>
                              <TableCell className="text-right text-sm tabular-nums">
                                {row.credit > 0 ? `$${row.credit.toFixed(2)}` : '—'}
                              </TableCell>
                              {hasSourceColumn && (
                                <TableCell className="text-muted-foreground max-w-32 truncate text-xs">
                                  {row.source}
                                </TableCell>
                              )}
                              {hasSourceColumn && (
                                <TableCell className="max-w-40 text-xs">
                                  {sourceValueTagFor(row.source) ? (
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span
                                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{
                                          backgroundColor: sourceValueTagFor(row.source)!.color,
                                        }}
                                      />
                                      {sourceValueTagFor(row.source)!.name}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">â€”</span>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={importing || preview.newCount === 0}
          onClick={onImport}
        >
          {importing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Import {preview.newCount} New Transaction
              {preview.newCount !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>

      {preview.newCount === 0 && (
        <p className="text-muted-foreground text-center text-sm">
          No new transactions to import — all rows are duplicates or have errors.
        </p>
      )}
    </>
  );
}
