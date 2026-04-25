import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashTransaction } from '@/lib/hash';
import { normalizeTransactionName } from '@/lib/normalize';
import Papa from 'papaparse';
import { parse as parseDate } from 'date-fns';
import type { ParsedTransaction } from '@/types';

// POST /api/import/preview - Parse CSV and check for duplicates without importing
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingJson = formData.get('mapping') as string | null;

    if (!file || !mappingJson) {
      return NextResponse.json({ error: 'File and mapping are required' }, { status: 400 });
    }

    const mapping = JSON.parse(mappingJson);
    const csvText = await file.text();

    const parseResult = Papa.parse<string[]>(csvText, {
      header: false,
      skipEmptyLines: true,
    });

    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      return NextResponse.json(
        { error: 'CSV parsing failed', details: parseResult.errors },
        { status: 400 },
      );
    }

    const getColumnValue = (row: string[], column: string | null | undefined) => {
      if (!column || column === 'none') return '';
      const columnNumber = Number(column);
      if (!Number.isInteger(columnNumber) || columnNumber < 1) return '';
      return (row[columnNumber - 1] || '').trim();
    };

    const rows: ParsedTransaction[] = [];

    for (const row of parseResult.data) {
      const rawName = getColumnValue(row, mapping.nameColumn);
      const rawDate = getColumnValue(row, mapping.dateColumn);
      const rawDebit = getColumnValue(row, mapping.debitColumn).replace(/[,$]/g, '');
      const rawCredit = getColumnValue(row, mapping.creditColumn).replace(/[,$]/g, '');
      const rawSource = getColumnValue(row, mapping.sourceColumn);

      if (!rawName || !rawDate) {
        rows.push({
          date: rawDate,
          name: rawName,
          debit: 0,
          credit: 0,
          source: rawSource,
          csvHash: '',
          normalizedName: '',
          isDuplicate: false,
          isDuplicateInDb: false,
          isDuplicateInCsv: false,
          error: 'Missing name or date',
        });
        continue;
      }

      const debit = Math.abs(parseFloat(rawDebit) || 0);
      const credit = Math.abs(parseFloat(rawCredit) || 0);

      let date: Date;
      try {
        if (mapping.dateFormat && mapping.dateFormat !== 'YYYY-MM-DD') {
          const fnsFormat = mapping.dateFormat
            .replace('YYYY', 'yyyy')
            .replace('DD', 'dd')
            .replace('MM', 'MM');
          date = parseDate(rawDate, fnsFormat, new Date());
        } else {
          date = new Date(rawDate);
        }

        if (isNaN(date.getTime())) {
          rows.push({
            date: rawDate,
            name: rawName,
            debit,
            credit,
            source: rawSource,
            csvHash: '',
            normalizedName: '',
            isDuplicate: false,
            isDuplicateInDb: false,
            isDuplicateInCsv: false,
            error: 'Invalid date format',
          });
          continue;
        }
      } catch {
        rows.push({
          date: rawDate,
          name: rawName,
          debit,
          credit,
          source: rawSource,
          csvHash: '',
          normalizedName: '',
          isDuplicate: false,
          isDuplicateInDb: false,
          isDuplicateInCsv: false,
          error: 'Date parse error',
        });
        continue;
      }

      const dateStr = date.toISOString().split('T')[0];
      const csvHash = await hashTransaction({ date: dateStr, name: rawName, debit, credit, source: rawSource });
      const normalizedName = normalizeTransactionName(rawName);

      rows.push({
        date: dateStr,
        name: rawName,
        normalizedName,
        debit,
        credit,
        source: rawSource,
        csvHash,
        isDuplicate: false,
        isDuplicateInDb: false,
        isDuplicateInCsv: false,
      });
    }

    // Check DB for existing hashes in one query
    const validRows = rows.filter((r) => !r.error && r.csvHash);
    const allHashes = validRows.map((r) => r.csvHash);

    const existing = await prisma.transaction.findMany({
      where: { csvHash: { in: allHashes } },
      select: { csvHash: true },
    });
    const dbHashes = new Set(existing.map((t) => t.csvHash));

    // Detect within-CSV duplicates and DB duplicates
    const seenInCsv = new Set<string>();
    const result: ParsedTransaction[] = rows.map((row) => {
      if (row.error || !row.csvHash) return row;

      const isDuplicateInDb = dbHashes.has(row.csvHash);
      const isDuplicateInCsv = seenInCsv.has(row.csvHash);
      seenInCsv.add(row.csvHash);

      return {
        ...row,
        isDuplicateInDb,
        isDuplicateInCsv,
        isDuplicate: isDuplicateInDb || isDuplicateInCsv,
      };
    });

    const errors = result.filter((r) => r.error).length;
    const duplicates = result.filter((r) => !r.error && r.isDuplicate).length;
    const newCount = result.filter((r) => !r.error && !r.isDuplicate).length;

    return NextResponse.json({
      total: result.length,
      newCount,
      duplicates,
      errors,
      rows: result,
    });
  } catch (e) {
    console.error('Preview failed:', e);
    return NextResponse.json({ error: 'Preview failed' }, { status: 500 });
  }
}
