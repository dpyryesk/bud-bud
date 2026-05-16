'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  ChevronRight,
  Trash2,
  Eye,
  Loader2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Papa from 'papaparse';
import type { ImportPreview, ImportResult } from '@/types';
import { Step, CsvMapping, SourceTag, DATE_FORMATS } from '@/components/import/constants';
import StepIndicator from '@/components/import/import-step-indicator';
import RowStatusBadge from '@/components/import/import-row-status-badge';

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');

  // Upload
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRawPreview, setCsvRawPreview] = useState<string[][]>([]);
  const [csvAllRows, setCsvAllRows] = useState<string[][]>([]);

  // Mapping config lists
  const [mappings, setMappings] = useState<CsvMapping[]>([]);
  const [sourceTags, setSourceTags] = useState<SourceTag[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');

  // Mapping form fields
  const [mappingName, setMappingName] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [sourceColumn, setSourceColumn] = useState<string | null>('');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [sourceTagId, setSourceTagId] = useState<string | null>('');
  const [sourceValueTagMap, setSourceValueTagMap] = useState<Record<string, string>>({});
  const [skipFirstRow, setSkipFirstRow] = useState(false);

  // Preview
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  // Import result
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const renderColumnLabel = useCallback((column: string) => `Column ${column}`, []);

  // ---- Data fetching ----

  const fetchMappings = useCallback(async () => {
    const res = await fetch('/api/csv-mappings');
    if (res.ok) setMappings(await res.json());
  }, []);

  const fetchSourceTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    if (res.ok) {
      const tags = await res.json();
      setSourceTags(tags.filter((t: SourceTag & { isSource: boolean }) => t.isSource));
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      void fetchMappings();
      void fetchSourceTags();
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchMappings, fetchSourceTags]);

  // ---- Handlers ----

  const loadMappingIntoForm = useCallback((m: CsvMapping) => {
    setMappingName(m.name);
    setDateColumn(m.dateColumn);
    setNameColumn(m.nameColumn);
    setDebitColumn(m.debitColumn);
    setCreditColumn(m.creditColumn);
    setSourceColumn(m.sourceColumn || '');
    setDateFormat(m.dateFormat || 'YYYY-MM-DD');
    setSkipFirstRow(Boolean(m.skipFirstRow));
    setSourceTagId(m.sourceTagId || '');
  }, []);

  const clearMappingForm = useCallback(() => {
    setMappingName('');
    setDateColumn('');
    setNameColumn('');
    setDebitColumn('');
    setCreditColumn('');
    setSourceColumn('');
    setDateFormat('YYYY-MM-DD');
    setSkipFirstRow(false);
    setSourceTagId('');
    setSourceValueTagMap({});
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);

    const text = await f.text();
    const parseResult = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    });

    const parsedRows = parseResult.data
      .filter((row) => row.some((cell) => String(cell).trim() !== ''))
      .map((row) => row.map((cell) => String(cell).trim()));

    if (parsedRows.length > 0) {
      const maxColumnCount = parsedRows.reduce((max, row) => Math.max(max, row.length), 0);
      const columns = Array.from({ length: maxColumnCount }, (_, i) => String(i + 1));
      setCsvHeaders(columns);
      setCsvAllRows(parsedRows);
      setCsvRawPreview(parsedRows.slice(0, 5));
    }
  };

  const handleSelectSavedMapping = (id: string) => {
    setSelectedMappingId(id);
    const m = mappings.find((m) => m.id === id);
    if (m) loadMappingIntoForm(m);
  };

  const handleClearSavedMapping = () => {
    setSelectedMappingId('');
    clearMappingForm();
  };

  const handleSaveMapping = async () => {
    if (!mappingName || !dateColumn || !nameColumn || !debitColumn || !creditColumn) return;
    const res = await fetch('/api/csv-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: mappingName,
        dateColumn,
        nameColumn,
        debitColumn,
        creditColumn,
        sourceColumn: sourceColumn || '',
        dateFormat,
        skipFirstRow,
        sourceTagId: sourceTagId || null,
      }),
    });
    if (res.ok) {
      await fetchMappings();
    }
  };

  const handleDeleteMapping = async (id: string) => {
    await fetch(`/api/csv-mappings/${id}`, { method: 'DELETE' });
    if (selectedMappingId === id) {
      setSelectedMappingId('');
      clearMappingForm();
    }
    await fetchMappings();
  };

  const getMappingForImport = () => {
    if (!dateColumn || !nameColumn || !debitColumn || !creditColumn) return null;
    // Only include non-empty per-value tag mappings
    const filteredValueTagMap = Object.fromEntries(
      Object.entries(sourceValueTagMap).filter(([, v]) => v && v !== ''),
    );
    return {
      name: mappingName,
      dateColumn,
      nameColumn,
      debitColumn,
      creditColumn,
      sourceColumn: sourceColumn && sourceColumn !== 'none' ? sourceColumn : '',
      dateFormat,
      sourceTagId: sourceTagId && sourceTagId !== 'none' ? sourceTagId : null,
      sourceValueTagMap: filteredValueTagMap,
      skipFirstRow,
    };
  };

  const handleLoadPreview = async () => {
    if (!file) return;
    const mapping = getMappingForImport();
    if (!mapping) return;

    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));

    try {
      const res = await fetch('/api/import/preview', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        setPreviewError(err.error || 'Preview failed');
      } else {
        const data = await res.json();
        setPreview(data);
        setStep('preview');
      }
    } catch (e) {
      setPreviewError('Preview failed: ' + String(e));
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    const mapping = getMappingForImport();
    if (!mapping) return;

    setImporting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    if (mapping.sourceTagId) {
      formData.append('sourceTagId', mapping.sourceTagId);
    }

    try {
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setResult({ total: 0, imported: 0, duplicates: 0, errors: 1 });
        console.error('Import failed:', data?.error || data);
        return;
      }

      setResult(data);
    } catch (e) {
      console.error('Import failed:', e);
      setResult({ total: 0, imported: 0, duplicates: 0, errors: 1 });
    } finally {
      setImporting(false);
      setStep('done');
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvHeaders([]);
    setCsvRawPreview([]);
    setCsvAllRows([]);
    setPreview(null);
    setResult(null);
    setSelectedMappingId('');
    setSkipFirstRow(false);
    setSourceValueTagMap({});
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uniqueSourceValues = useMemo(() => {
    if (!sourceColumn || sourceColumn === '_none') return [];
    const colIndex = Number(sourceColumn) - 1;
    if (colIndex < 0) return [];
    const rowsToUse = skipFirstRow ? csvAllRows.slice(1) : csvAllRows;
    const values = new Set<string>();
    for (const row of rowsToUse) {
      const val = (row[colIndex] || '').trim();
      if (val) values.add(val);
    }
    return Array.from(values).sort();
  }, [sourceColumn, csvAllRows, skipFirstRow]);

  const mappingIsReady = !!(dateColumn && nameColumn && debitColumn && creditColumn);
  const hasSourceColumn = preview?.rows.some((r) => r.source);

  // ---- Render ----

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Transactions</h1>
      <StepIndicator current={step} />

      {/* ─── STEP 1: Upload ─── */}
      {step === 'upload' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                CSV File
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="hover:border-primary cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f && f.name.endsWith('.csv')) {
                    // Simulate file input change
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    if (fileInputRef.current) {
                      fileInputRef.current.files = dt.files;
                      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                  }
                }}
              >
                <Upload className="text-muted-foreground mx-auto h-10 w-10" />
                <p className="mt-2 font-medium">
                  {file ? file.name : 'Click or drag a CSV file here'}
                </p>
                <p className="text-muted-foreground text-sm">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Accepted format: .csv'}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {csvHeaders.length > 0 && (
                <div className="mt-4">
                  <p className="text-muted-foreground mb-2 text-sm font-medium">
                    File preview — {csvHeaders.length} columns detected
                  </p>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {csvHeaders.map((column, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left font-medium whitespace-nowrap"
                            >
                              {renderColumnLabel(column)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRawPreview.map((row, i) => (
                          <tr key={i} className="border-t">
                            {csvHeaders.map((column, j) => (
                              <td key={j} className="max-w-48 truncate px-3 py-1.5">
                                {row[Number(column) - 1] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {file && csvHeaders.length > 0 && (
            <Button size="lg" className="w-full" onClick={() => setStep('configure')}>
              Next: Configure Mapping
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </>
      )}

      {/* ─── STEP 2: Configure Mapping ─── */}
      {step === 'configure' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Column Mapping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Saved mappings list */}
              {mappings.length > 0 && (
                <div>
                  <Label className="mb-2 block text-sm">Saved Mappings</Label>
                  <div className="space-y-1.5">
                    {mappings.map((m) => (
                      <div
                        key={m.id}
                        className={`flex cursor-pointer items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                          selectedMappingId === m.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectSavedMapping(m.id)}
                      >
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-muted-foreground ml-2 truncate text-xs">
                            {renderColumnLabel(m.dateColumn)} · {renderColumnLabel(m.nameColumn)} ·{' '}
                            {renderColumnLabel(m.debitColumn)}/{renderColumnLabel(m.creditColumn)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {selectedMappingId === m.id && <Check className="text-primary h-4 w-4" />}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMapping(m.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {selectedMappingId && (
                    <button
                      className="text-muted-foreground hover:text-foreground mt-1.5 text-xs underline"
                      onClick={handleClearSavedMapping}
                    >
                      Clear selection (configure manually)
                    </button>
                  )}
                  <div className="my-4 border-t" />
                </div>
              )}

              {/* Mapping form */}
              {csvHeaders.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2 text-sm font-medium">
                    File preview — {csvHeaders.length} columns detected
                  </p>
                  <div className="overflow-x-auto rounded border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          {csvHeaders.map((column, i) => (
                            <th
                              key={i}
                              className="px-3 py-2 text-left font-medium whitespace-nowrap"
                            >
                              {renderColumnLabel(column)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRawPreview.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-t ${skipFirstRow && i === 0 ? 'opacity-40' : ''}`}
                          >
                            {csvHeaders.map((column, j) => (
                              <td
                                key={j}
                                className={`max-w-48 truncate px-3 py-1.5 ${skipFirstRow && i === 0 ? 'italic' : ''}`}
                              >
                                {skipFirstRow && i === 0 && j === 0 ? (
                                  <span className="text-muted-foreground mr-1 font-medium not-italic">
                                    [header]
                                  </span>
                                ) : null}
                                {row[Number(column) - 1] || ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Mapping Name</Label>
                  <Input
                    value={mappingName}
                    onChange={(e) => setMappingName(e.target.value)}
                    placeholder="e.g., TD Bank Chequing"
                  />
                </div>

                <div>
                  <Label>
                    Date Column <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={dateColumn}
                    onValueChange={(v) => {
                      if (v) setDateColumn(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((column) => (
                        <SelectItem key={column} value={column}>
                          {renderColumnLabel(column)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Date Format</Label>
                  <Select
                    value={dateFormat}
                    onValueChange={(v) => {
                      if (v) setDateFormat(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    Description Column <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={nameColumn}
                    onValueChange={(v) => {
                      if (v) setNameColumn(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((column) => (
                        <SelectItem key={column} value={column}>
                          {renderColumnLabel(column)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    Debit Column (spending) <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={debitColumn}
                    onValueChange={(v) => {
                      if (v) setDebitColumn(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((column) => (
                        <SelectItem key={column} value={column}>
                          {renderColumnLabel(column)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>
                    Credit Column (income/refunds) <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={creditColumn}
                    onValueChange={(v) => {
                      if (v) setCreditColumn(v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      {csvHeaders.map((column) => (
                        <SelectItem key={column} value={column}>
                          {renderColumnLabel(column)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Source Column (optional)</Label>
                  <Select
                    value={sourceColumn || '_none'}
                    onValueChange={(v) => {
                      setSourceColumn(v === '_none' ? '' : v);
                      setSourceValueTagMap({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {csvHeaders.map((column) => (
                        <SelectItem key={column} value={column}>
                          {renderColumnLabel(column)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <label className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-current"
                      checked={skipFirstRow}
                      onChange={(e) => setSkipFirstRow(e.target.checked)}
                    />
                    <span className="text-sm font-medium">Skip first row (it is a header)</span>
                  </label>
                  <p className="text-muted-foreground mt-1 ml-6 text-xs">
                    Check this if the first row contains column labels rather than transaction data.
                  </p>
                </div>
              </div>

              {/* Source tag */}
              {sourceTags.length > 0 && (
                <>
                  <div>
                    <Label>Source Tag</Label>
                    <Select
                      value={sourceTagId || '_none'}
                      onValueChange={(v) => setSourceTagId(v === '_none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None">
                          {(v: string | null) => {
                            if (!v || v === '_none') return 'None';
                            const tag = sourceTags.find((t) => t.id === v);
                            return tag ? (
                              <span className="flex items-center gap-1.5">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </span>
                            ) : (
                              'None'
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {sourceTags.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            <span className="flex items-center gap-1.5">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: t.color }}
                              />
                              {t.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-muted-foreground mt-1 text-xs">
                      All imported transactions will be tagged with this source tag.
                    </p>
                  </div>

                  {/* Source value tag mapping */}
                  {sourceColumn && sourceColumn !== '_none' && uniqueSourceValues.length > 0 && (
                    <div className="rounded-md border p-3">
                      <p className="text-sm font-medium">Source Value Tags</p>
                      <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
                        Optionally map specific source values to additional source tags.
                        Transactions with a mapped value will receive both the overall source tag
                        and the value-specific tag.
                      </p>
                      <div className="space-y-2">
                        {uniqueSourceValues.map((value) => (
                          <div key={value} className="flex items-center gap-3">
                            <span className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 font-mono text-xs">
                              {value}
                            </span>
                            <Select
                              value={sourceValueTagMap[value] || '_none'}
                              onValueChange={(v) => {
                                const tagId = v && v !== '_none' ? v : '';
                                setSourceValueTagMap((prev) => ({ ...prev, [value]: tagId }));
                              }}
                            >
                              <SelectTrigger className="w-48 shrink-0">
                                <SelectValue>
                                  {(v: string | null) => {
                                    if (!v || v === '_none') return 'No tag';
                                    const tag = sourceTags.find((t) => t.id === v);
                                    return tag ? (
                                      <span className="flex items-center gap-1.5">
                                        <span
                                          className="inline-block h-2.5 w-2.5 rounded-full"
                                          style={{ backgroundColor: tag.color }}
                                        />
                                        {tag.name}
                                      </span>
                                    ) : (
                                      'No tag'
                                    );
                                  }}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none">No tag</SelectItem>
                                {sourceTags.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    <span className="flex items-center gap-1.5">
                                      <span
                                        className="inline-block h-2.5 w-2.5 rounded-full"
                                        style={{ backgroundColor: t.color }}
                                      />
                                      {t.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Save mapping */}
              {mappingName && mappingIsReady && !selectedMappingId && (
                <Button variant="outline" size="sm" onClick={handleSaveMapping}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Save Mapping for Reuse
                </Button>
              )}

              {previewError && (
                <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {previewError}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={!mappingIsReady || previewLoading}
              onClick={handleLoadPreview}
            >
              {previewLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Preview…
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Import
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {/* ─── STEP 3: Preview ─── */}
      {step === 'preview' && preview && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                { label: 'Total Rows', value: preview.total, color: '' },
                { label: 'New', value: preview.newCount, color: 'text-green-600' },
                { label: 'Duplicates', value: preview.duplicates, color: 'text-yellow-600' },
                { label: 'Errors', value: preview.errors, color: 'text-red-600' },
              ] as const
            ).map(({ label, value, color }) => (
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
                  <TabsTrigger value="all">All ({preview.total})</TabsTrigger>
                  <TabsTrigger value="new">New ({preview.newCount})</TabsTrigger>
                  <TabsTrigger value="duplicates">Duplicates ({preview.duplicates})</TabsTrigger>
                  {preview.errors > 0 && (
                    <TabsTrigger value="errors">Errors ({preview.errors})</TabsTrigger>
                  )}
                </TabsList>

                {(['all', 'new', 'duplicates', 'errors'] as const).map((tab) => {
                  const rows = preview.rows.filter((r) => {
                    if (tab === 'all') return true;
                    if (tab === 'new') return !r.error && !r.isDuplicate;
                    if (tab === 'duplicates') return !r.error && r.isDuplicate;
                    if (tab === 'errors') return !!r.error;
                    return false;
                  });

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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={hasSourceColumn ? 6 : 5}
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
            <Button variant="outline" onClick={() => setStep('configure')}>
              Back
            </Button>
            <Button
              className="flex-1"
              disabled={importing || preview.newCount === 0}
              onClick={handleImport}
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
      )}

      {/* ─── STEP 4: Done ─── */}
      {step === 'done' && result && (
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
                {(
                  [
                    { label: 'Total Rows', value: result.total, color: '' },
                    { label: 'Imported', value: result.imported, color: 'text-green-600' },
                    {
                      label: 'Duplicates Skipped',
                      value: result.duplicates,
                      color: 'text-yellow-600',
                    },
                    {
                      label: 'Errors',
                      value: result.errors,
                      color: result.errors > 0 ? 'text-red-600' : 'text-muted-foreground',
                    },
                  ] as const
                ).map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                    <p className="text-muted-foreground text-sm">{label}</p>
                  </div>
                ))}
              </div>

              {result.errors > 0 && (
                <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {result.errors} row{result.errors !== 1 ? 's' : ''} could not be imported due to
                  parse errors.
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

          <Button onClick={handleReset} variant="outline" className="w-full">
            Import Another File
          </Button>
        </>
      )}
    </div>
  );
}
