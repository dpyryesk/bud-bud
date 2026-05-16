import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashTransaction } from '@/lib/hash';
import { normalizeTransactionName } from '@/lib/normalize';
import { parseDateInputAsUtc } from '@/lib/date-utils';
import Papa from 'papaparse';
import { parse as parseDate } from 'date-fns';

// POST /api/import - Upload and import CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mappingJson = formData.get('mapping') as string | null;
    const sourceTagId = formData.get('sourceTagId') as string | null;

    if (!file || !mappingJson) {
      return NextResponse.json({ error: 'File and mapping are required' }, { status: 400 });
    }

    const mapping = JSON.parse(mappingJson);
    const csvText = await file.text();

    // Parse CSV
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

    const csvRows = mapping.skipFirstRow ? parseResult.data.slice(1) : parseResult.data;

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const row of csvRows) {
      try {
        const rawName = getColumnValue(row, mapping.nameColumn);
        const rawDate = getColumnValue(row, mapping.dateColumn);
        const rawDebit = getColumnValue(row, mapping.debitColumn).replace(/[,$]/g, '');
        const rawCredit = getColumnValue(row, mapping.creditColumn).replace(/[,$]/g, '');
        const rawSource = getColumnValue(row, mapping.sourceColumn);

        if (!rawName || !rawDate) {
          errors++;
          continue;
        }

        const debit = Math.abs(parseFloat(rawDebit) || 0);
        const credit = Math.abs(parseFloat(rawCredit) || 0);

        // Parse date with format
        let date: Date;
        if (mapping.dateFormat && mapping.dateFormat !== 'YYYY-MM-DD') {
          // Convert common date format tokens to date-fns tokens
          const fnsFormat = mapping.dateFormat
            .replace('YYYY', 'yyyy')
            .replace('DD', 'dd')
            .replace('MM', 'MM');
          const localDate = parseDate(rawDate, fnsFormat, new Date());
          // Normalize to UTC midnight using local calendar components
          date = new Date(
            Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()),
          );
        } else {
          // YYYY-MM-DD strings are already UTC midnight per ECMAScript spec, but
          // parseDateInputAsUtc uses the component approach so behaviour is explicit
          // and immune to any future runtime changes.
          date = parseDateInputAsUtc(rawDate);
        }

        if (isNaN(date.getTime())) {
          errors++;
          continue;
        }

        const csvHash = await hashTransaction({
          date: date.toISOString().split('T')[0],
          name: rawName,
          debit,
          credit,
          source: rawSource,
        });

        const normalizedName = normalizeTransactionName(rawName);

        // Try to insert, skip on duplicate hash
        try {
          await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
              data: {
                date,
                name: rawName,
                normalizedName,
                debit,
                credit,
                source: rawSource,
                csvHash,
              },
            });

            // Apply overall source tag if provided
            if (sourceTagId) {
              await tx.transactionTag.create({
                data: {
                  transactionId: transaction.id,
                  tagId: sourceTagId,
                },
              });
            }

            // Apply per-value source tag if provided and different from overall tag
            const sourceValueTagMap = mapping.sourceValueTagMap as
              | Record<string, string>
              | undefined;
            if (sourceValueTagMap && rawSource && sourceValueTagMap[rawSource]) {
              const valueTagId = sourceValueTagMap[rawSource];
              if (valueTagId !== sourceTagId) {
                await tx.transactionTag.create({
                  data: {
                    transactionId: transaction.id,
                    tagId: valueTagId,
                  },
                });
              }
            }
          });

          imported++;
        } catch (e: unknown) {
          // Check for unique constraint violation (duplicate)
          if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
            duplicates++;
          } else {
            errors++;
          }
        }
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      total: csvRows.length,
      imported,
      duplicates,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Import failed', details: String(e) }, { status: 500 });
  }
}
