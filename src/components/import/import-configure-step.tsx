import { AlertCircle, Eye, Loader2, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CsvMapping, SourceTag } from '@/components/import/constants';
import CsvRawPreview from '@/components/import/import-csv-raw-preview';
import ImportSavedMappingsList from '@/components/import/import-saved-mappings-list';
import ImportMappingForm from '@/components/import/import-mapping-form';

interface ImportConfigureStepProps {
  // CSV data
  csvHeaders: string[];
  csvRawPreview: string[][];
  // Saved mappings
  mappings: CsvMapping[];
  selectedMappingId: string;
  onSelectMapping: (id: string) => void;
  onDeleteMapping: (id: string) => void;
  onClearMapping: () => void;
  // Form fields
  mappingName: string;
  setMappingName: (v: string) => void;
  dateColumn: string;
  setDateColumn: (v: string) => void;
  nameColumn: string;
  setNameColumn: (v: string) => void;
  debitColumn: string;
  setDebitColumn: (v: string) => void;
  creditColumn: string;
  setCreditColumn: (v: string) => void;
  sourceColumn: string | null;
  setSourceColumn: (v: string | null) => void;
  dateFormat: string;
  setDateFormat: (v: string) => void;
  skipFirstRow: boolean;
  setSkipFirstRow: (v: boolean) => void;
  sourceTagId: string | null;
  setSourceTagId: (v: string | null) => void;
  sourceValueTagMap: Record<string, string>;
  setSourceValueTagMap: (
    v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  sourceTags: SourceTag[];
  uniqueSourceValues: string[];
  // Actions
  mappingIsReady: boolean;
  onSaveMapping: () => void;
  onUpdateMapping: () => void;
  previewLoading: boolean;
  previewError: string;
  onBack: () => void;
  onPreview: () => void;
}

export default function ImportConfigureStep({
  csvHeaders,
  csvRawPreview,
  mappings,
  selectedMappingId,
  onSelectMapping,
  onDeleteMapping,
  onClearMapping,
  mappingName,
  setMappingName,
  dateColumn,
  setDateColumn,
  nameColumn,
  setNameColumn,
  debitColumn,
  setDebitColumn,
  creditColumn,
  setCreditColumn,
  sourceColumn,
  setSourceColumn,
  dateFormat,
  setDateFormat,
  skipFirstRow,
  setSkipFirstRow,
  sourceTagId,
  setSourceTagId,
  sourceValueTagMap,
  setSourceValueTagMap,
  sourceTags,
  uniqueSourceValues,
  mappingIsReady,
  onSaveMapping,
  onUpdateMapping,
  previewLoading,
  previewError,
  onBack,
  onPreview,
}: ImportConfigureStepProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Column Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <ImportSavedMappingsList
            mappings={mappings}
            selectedMappingId={selectedMappingId}
            onSelect={onSelectMapping}
            onDelete={onDeleteMapping}
            onClear={onClearMapping}
          />

          <CsvRawPreview
            csvHeaders={csvHeaders}
            csvRawPreview={csvRawPreview}
            skipFirstRow={skipFirstRow}
          />

          <ImportMappingForm
            csvHeaders={csvHeaders}
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
          />

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!!selectedMappingId || !mappingName || !mappingIsReady}
              onClick={onSaveMapping}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create New Mapping
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedMappingId || !mappingName || !mappingIsReady}
              onClick={onUpdateMapping}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Update Saved Mapping
            </Button>
          </div>

          {previewError && (
            <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {previewError}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" disabled={!mappingIsReady || previewLoading} onClick={onPreview}>
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
  );
}
