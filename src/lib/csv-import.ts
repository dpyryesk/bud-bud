import { isValid, parse } from 'date-fns';
import Papa from 'papaparse';
import { z } from 'zod';
import { hashText, hashTransaction } from '@/lib/hash';
import { fromCents, toCents } from '@/lib/money';
import { normalizeTransactionName } from '@/lib/normalize';

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
export const MAX_CSV_ROWS = 5_000;
const MAX_CSV_COLUMNS = 200;
const MAX_CELL_LENGTH = 10_000;

const columnSchema = z
  .union([z.literal(''), z.literal('none'), z.coerce.number().int().min(1).max(MAX_CSV_COLUMNS)])
  .transform(String);

export const importMappingSchema = z
  .object({
    name: z.string().max(200).optional(),
    dateColumn: columnSchema.refine((value) => value !== '' && value !== 'none'),
    nameColumn: columnSchema.refine((value) => value !== '' && value !== 'none'),
    debitColumn: columnSchema,
    creditColumn: columnSchema,
    sourceColumn: columnSchema.default(''),
    dateFormat: z
      .enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MM-DD-YYYY'])
      .default('YYYY-MM-DD'),
    sourceTagId: z.string().trim().min(1).max(128).nullable().optional(),
    sourceValueTagMap: z
      .record(z.string().max(MAX_CELL_LENGTH), z.string().min(1).max(128))
      .default({}),
    skipFirstRow: z.boolean().default(false),
  })
  .strict()
  .refine(
    (value) => value.debitColumn !== 'none' || value.creditColumn !== 'none',
    'At least one amount column is required',
  );

export type ImportMapping = z.infer<typeof importMappingSchema>;

export type ParsedCsvRow = {
  rowIndex: number;
  date: string;
  dateValue: Date | null;
  name: string;
  normalizedName: string;
  debit: number;
  credit: number;
  debitCents: number;
  creditCents: number;
  source: string;
  csvHash: string;
  importKey: string;
  error?: string;
};

function getColumn(row: string[], column: string) {
  if (!column || column === 'none') return '';
  return (row[Number(column) - 1] ?? '').trim();
}

function parseAmount(raw: string): number {
  if (!raw.trim()) return 0;
  let value = raw.trim();
  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[$,\s]/g, '');
  if (!/^[+-]?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Invalid amount');
  const cents = toCents(value);
  return Math.abs(negative ? -cents : cents);
}

function parseMappedDate(raw: string, dateFormat: ImportMapping['dateFormat']): Date | null {
  const token = {
    'YYYY-MM-DD': 'yyyy-MM-dd',
    'MM/DD/YYYY': 'MM/dd/yyyy',
    'DD/MM/YYYY': 'dd/MM/yyyy',
    'MM-DD-YYYY': 'MM-dd-yyyy',
  }[dateFormat];
  const parsed = parse(raw, token, new Date(0));
  if (!isValid(parsed)) return null;
  const date = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  const expected = raw.match(/\d+/g)?.map(Number) ?? [];
  const actual =
    dateFormat === 'YYYY-MM-DD'
      ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
      : dateFormat.startsWith('MM')
        ? [date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCFullYear()]
        : [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()];
  return expected.length === 3 && expected.every((value, index) => value === actual[index])
    ? date
    : null;
}

export function checkCsvRequest(request: Request) {
  const length = Number(request.headers.get('content-length') ?? 0);
  return !Number.isFinite(length) || length <= MAX_CSV_BYTES + 256 * 1024;
}

export async function parseCsvFile(file: File, mapping: ImportMapping) {
  if (file.size > MAX_CSV_BYTES) throw new Error('CSV file exceeds the 5 MiB limit');
  const csvText = await file.text();
  const fileHash = await hashText(csvText);
  const result = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true });
  if (result.errors.length) throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
  const rows = mapping.skipFirstRow ? result.data.slice(1) : result.data;
  if (rows.length > MAX_CSV_ROWS) throw new Error(`CSV exceeds the ${MAX_CSV_ROWS} row limit`);
  if (rows.some((row) => row.length > MAX_CSV_COLUMNS)) throw new Error('CSV has too many columns');
  if (rows.some((row) => row.some((cell) => cell.length > MAX_CELL_LENGTH))) {
    throw new Error('CSV contains an excessively long cell');
  }

  const mappingIdentity = JSON.stringify({
    dateColumn: mapping.dateColumn,
    nameColumn: mapping.nameColumn,
    debitColumn: mapping.debitColumn,
    creditColumn: mapping.creditColumn,
    sourceColumn: mapping.sourceColumn,
    dateFormat: mapping.dateFormat,
    sourceTagId: mapping.sourceTagId ?? null,
    sourceValueTagMap: Object.entries(mapping.sourceValueTagMap).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
    skipFirstRow: mapping.skipFirstRow,
  });
  const mappingHash = await hashText(mappingIdentity);

  return Promise.all(
    rows.map(async (row, offset): Promise<ParsedCsvRow> => {
      const rowIndex = offset + (mapping.skipFirstRow ? 1 : 0);
      const name = getColumn(row, mapping.nameColumn);
      const rawDate = getColumn(row, mapping.dateColumn);
      const source = getColumn(row, mapping.sourceColumn);
      const importKey = await hashText(`${fileHash}|${mappingHash}|${rowIndex}`);
      let debitCents = 0;
      let creditCents = 0;
      try {
        if (!name || !rawDate) throw new Error('Missing name or date');
        debitCents = parseAmount(getColumn(row, mapping.debitColumn));
        creditCents = parseAmount(getColumn(row, mapping.creditColumn));
        const dateValue = parseMappedDate(rawDate, mapping.dateFormat);
        if (!dateValue) throw new Error('Invalid date format');
        const date = dateValue.toISOString().slice(0, 10);
        const csvHash = await hashTransaction({
          date,
          name,
          debit: debitCents,
          credit: creditCents,
          source,
        });
        return {
          rowIndex,
          date,
          dateValue,
          name,
          normalizedName: normalizeTransactionName(name),
          debit: fromCents(debitCents),
          credit: fromCents(creditCents),
          debitCents,
          creditCents,
          source,
          csvHash,
          importKey,
        };
      } catch (error) {
        return {
          rowIndex,
          date: rawDate,
          dateValue: null,
          name,
          normalizedName: '',
          debit: fromCents(debitCents),
          credit: fromCents(creditCents),
          debitCents,
          creditCents,
          source,
          csvHash: '',
          importKey,
          error: error instanceof Error ? error.message : 'Invalid row',
        };
      }
    }),
  );
}
