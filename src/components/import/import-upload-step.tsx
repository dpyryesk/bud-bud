import { RefObject } from 'react';
import { Upload, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import CsvRawPreview from '@/components/import/import-csv-raw-preview';

interface ImportUploadStepProps {
  file: File | null;
  csvHeaders: string[];
  csvRawPreview: string[][];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNext: () => void;
}

export default function ImportUploadStep({
  file,
  csvHeaders,
  csvRawPreview,
  fileInputRef,
  onFileSelect,
  onNext,
}: ImportUploadStepProps) {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.csv')) {
      const dt = new DataTransfer();
      dt.items.add(f);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  };

  return (
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
            onDrop={handleDrop}
          >
            <Upload className="text-muted-foreground mx-auto h-10 w-10" />
            <p className="mt-2 font-medium">{file ? file.name : 'Click or drag a CSV file here'}</p>
            <p className="text-muted-foreground text-sm">
              {file ? `${(file.size / 1024).toFixed(1)} KB` : 'Accepted format: .csv'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileSelect}
            />
          </div>

          <CsvRawPreview csvHeaders={csvHeaders} csvRawPreview={csvRawPreview} className="mt-4" />
        </CardContent>
      </Card>

      {file && csvHeaders.length > 0 && (
        <Button size="lg" className="w-full" onClick={onNext}>
          Next: Configure Mapping
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </>
  );
}
