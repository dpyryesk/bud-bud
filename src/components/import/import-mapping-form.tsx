import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DATE_FORMATS, type SourceTag } from '@/components/import/constants';

interface ImportMappingFormProps {
  csvHeaders: string[];
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
}

export default function ImportMappingForm({
  csvHeaders,
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
}: ImportMappingFormProps) {
  return (
    <div className="space-y-5">
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
                  Column {column}
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
                  Column {column}
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
                  Column {column}
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
                  Column {column}
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
                  Column {column}
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

          {sourceColumn && sourceColumn !== '_none' && uniqueSourceValues.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium">Source Value Tags</p>
              <p className="text-muted-foreground mt-0.5 mb-3 text-xs">
                Optionally map specific source values to additional source tags. Transactions with a
                mapped value will receive both the overall source tag and the value-specific tag.
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
    </div>
  );
}
