'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import type { ImportPreview, ImportResult } from '@/types';
import { type Step, type CsvMapping, type SourceTag } from '@/components/import/constants';
import StepIndicator from '@/components/import/import-step-indicator';
import ImportUploadStep from '@/components/import/import-upload-step';
import ImportConfigureStep from '@/components/import/import-configure-step';
import ImportPreviewStep from '@/components/import/import-preview-step';
import ImportDoneStep from '@/components/import/import-done-step';
import { buildTagsInDisplayOrder } from '@/lib/tag-tree';

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

  // ---- Data fetching ----

  const fetchMappings = useCallback(async () => {
    const res = await fetch('/api/csv-mappings');
    if (res.ok) setMappings(await res.json());
  }, []);

  const fetchSourceTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    if (res.ok) {
      const tags = await res.json();
      setSourceTags(
        buildTagsInDisplayOrder(
          tags.filter((tag: SourceTag & { isSource: boolean }) => tag.isSource),
        ),
      );
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
    const parseResult = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });

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
    if (res.ok) await fetchMappings();
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
        setPreview(await res.json());
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
    if (mapping.sourceTagId) formData.append('sourceTagId', mapping.sourceTagId);

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

  // ---- Render ----

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Transactions</h1>
      <StepIndicator current={step} />

      {step === 'upload' && (
        <ImportUploadStep
          file={file}
          csvHeaders={csvHeaders}
          csvRawPreview={csvRawPreview}
          fileInputRef={fileInputRef}
          onFileSelect={handleFileSelect}
          onNext={() => setStep('configure')}
        />
      )}

      {step === 'configure' && (
        <ImportConfigureStep
          csvHeaders={csvHeaders}
          csvRawPreview={csvRawPreview}
          mappings={mappings}
          selectedMappingId={selectedMappingId}
          onSelectMapping={handleSelectSavedMapping}
          onDeleteMapping={handleDeleteMapping}
          onClearMapping={handleClearSavedMapping}
          mappingName={mappingName}
          setMappingName={setMappingName}
          dateColumn={dateColumn}
          setDateColumn={setDateColumn}
          nameColumn={nameColumn}
          setNameColumn={setNameColumn}
          debitColumn={debitColumn}
          setDebitColumn={setDebitColumn}
          creditColumn={creditColumn}
          setCreditColumn={setCreditColumn}
          sourceColumn={sourceColumn}
          setSourceColumn={setSourceColumn}
          dateFormat={dateFormat}
          setDateFormat={setDateFormat}
          skipFirstRow={skipFirstRow}
          setSkipFirstRow={setSkipFirstRow}
          sourceTagId={sourceTagId}
          setSourceTagId={setSourceTagId}
          sourceValueTagMap={sourceValueTagMap}
          setSourceValueTagMap={setSourceValueTagMap}
          sourceTags={sourceTags}
          uniqueSourceValues={uniqueSourceValues}
          mappingIsReady={mappingIsReady}
          onSaveMapping={handleSaveMapping}
          previewLoading={previewLoading}
          previewError={previewError}
          onBack={() => setStep('upload')}
          onPreview={handleLoadPreview}
        />
      )}

      {step === 'preview' && preview && (
        <ImportPreviewStep
          preview={preview}
          importing={importing}
          onBack={() => setStep('configure')}
          onImport={handleImport}
        />
      )}

      {step === 'done' && result && <ImportDoneStep result={result} onReset={handleReset} />}
    </div>
  );
}
