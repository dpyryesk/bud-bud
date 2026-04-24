'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ImportResult } from '@/types';

type CsvMapping = {
  id: string;
  name: string;
  dateColumn: string;
  nameColumn: string;
  debitColumn: string;
  creditColumn: string;
  sourceColumn: string;
  dateFormat: string;
  sourceTagId: string | null;
};

type SourceTag = {
  id: string;
  name: string;
  color: string;
};

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<CsvMapping[]>([]);
  const [sourceTags, setSourceTags] = useState<SourceTag[]>([]);
  const [selectedMappingId, setSelectedMappingId] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // New mapping form
  const [newMappingName, setNewMappingName] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [sourceColumn, setSourceColumn] = useState('');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [selectedSourceTagId, setSelectedSourceTagId] = useState<string>('');
  const [showNewMapping, setShowNewMapping] = useState(false);

  const fetchMappings = useCallback(async () => {
    const res = await fetch('/api/csv-mappings');
    setMappings(await res.json());
  }, []);

  const fetchSourceTags = useCallback(async () => {
    const res = await fetch('/api/tags');
    const tags = await res.json();
    setSourceTags(tags.filter((t: SourceTag & { isSource: boolean }) => t.isSource));
  }, []);

  useEffect(() => {
    fetchMappings();
    fetchSourceTags();
  }, [fetchMappings, fetchSourceTags]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    const text = await f.text();
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length > 0) {
      const headers = lines[0].split(',').map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
      setCsvHeaders(headers);

      const preview = lines.slice(1, 6).map((line) =>
        line.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1')),
      );
      setCsvPreview(preview);
    }
  };

  const handleSaveMapping = async () => {
    if (!newMappingName || !dateColumn || !nameColumn || !debitColumn || !creditColumn) return;

    await fetch('/api/csv-mappings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newMappingName,
        dateColumn,
        nameColumn,
        debitColumn,
        creditColumn,
        sourceColumn,
        dateFormat,
        sourceTagId: selectedSourceTagId || null,
      }),
    });

    await fetchMappings();
    setShowNewMapping(false);
  };

  const getActiveMapping = (): CsvMapping | null => {
    if (selectedMappingId) {
      return mappings.find((m) => m.id === selectedMappingId) || null;
    }
    if (showNewMapping && dateColumn && nameColumn && debitColumn && creditColumn) {
      return {
        id: '',
        name: newMappingName,
        dateColumn,
        nameColumn,
        debitColumn,
        creditColumn,
        sourceColumn,
        dateFormat,
        sourceTagId: selectedSourceTagId || null,
      };
    }
    return null;
  };

  const handleImport = async () => {
    if (!file) return;
    const mapping = getActiveMapping();
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
      setResult(data);
    } catch (e) {
      setResult({ total: 0, imported: 0, duplicates: 0, errors: 1 });
      console.error('Import failed:', e);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Import Transactions</h1>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV File
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {file ? file.name : 'Click to select a CSV file'}
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
              <p className="text-sm font-medium">
                Preview ({csvPreview.length} of {csvPreview.length}+ rows):
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      {csvHeaders.map((h, i) => (
                        <th key={i} className="border px-2 py-1 text-left font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="border px-2 py-1">
                            {cell}
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

      {/* Column Mapping */}
      {csvHeaders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Column Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {mappings.length > 0 && !showNewMapping && (
              <div>
                <Label>Use saved mapping</Label>
                <Select value={selectedMappingId} onValueChange={(v) => { if (v !== null) { setSelectedMappingId(v); setShowNewMapping(false); } }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a mapping..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mappings.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="link" className="mt-1 p-0 text-xs" onClick={() => { setShowNewMapping(true); setSelectedMappingId(''); }}>
                  Or create a new mapping
                </Button>
              </div>
            )}

            {(showNewMapping || mappings.length === 0) && (
              <div className="space-y-3">
                <div>
                  <Label>Mapping Name</Label>
                  <Input value={newMappingName} onChange={(e) => setNewMappingName(e.target.value)} placeholder="e.g., TD Bank" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date Column</Label>
                    <Select value={dateColumn} onValueChange={(v) => { if (v !== null) setDateColumn(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date Format</Label>
                    <Select value={dateFormat} onValueChange={(v) => { if (v !== null) setDateFormat(v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Name Column</Label>
                    <Select value={nameColumn} onValueChange={(v) => { if (v !== null) setNameColumn(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Debit Column</Label>
                    <Select value={debitColumn} onValueChange={(v) => { if (v !== null) setDebitColumn(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Credit Column</Label>
                    <Select value={creditColumn} onValueChange={(v) => { if (v !== null) setCreditColumn(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Source Column (optional)</Label>
                    <Select value={sourceColumn} onValueChange={(v) => { if (v !== null) setSourceColumn(v); }}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {csvHeaders.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Source Tag</Label>
                  <Select value={selectedSourceTagId} onValueChange={(v) => { if (v !== null) setSelectedSourceTagId(v); }}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sourceTags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    All imported transactions will be tagged with this source tag
                  </p>
                </div>

                {newMappingName && dateColumn && nameColumn && debitColumn && creditColumn && (
                  <Button variant="outline" size="sm" onClick={handleSaveMapping}>
                    Save Mapping for Reuse
                  </Button>
                )}

                {mappings.length > 0 && (
                  <Button variant="link" className="p-0 text-xs" onClick={() => { setShowNewMapping(false); }}>
                    Use saved mapping instead
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Button */}
      {file && getActiveMapping() && (
        <Button onClick={handleImport} disabled={importing} size="lg" className="w-full">
          {importing ? 'Importing...' : 'Import Transactions'}
        </Button>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  <Check className="mr-1 inline h-5 w-5" />
                  {result.imported}
                </p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicates Skipped</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {result.errors > 0 && <AlertCircle className="mr-1 inline h-5 w-5" />}
                  {result.errors}
                </p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
