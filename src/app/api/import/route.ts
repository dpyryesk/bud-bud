import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashTransaction } from '@/lib/hash';
import { normalizeTransactionName } from '@/lib/normalize';
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
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      return NextResponse.json(
        { error: 'CSV parsing failed', details: parseResult.errors },
        { status: 400 },
      );
    }

    let imported = 0;
    let duplicates = 0;
    let errors = 0;

    for (const row of parseResult.data as Record<string, string>[]) {
      try {
        const rawName = (row[mapping.nameColumn] || '').trim();
        const rawDate = (row[mapping.dateColumn] || '').trim();
        const rawDebit = (row[mapping.debitColumn] || '0').trim().replace(/[,$]/g, '');
        const rawCredit = (row[mapping.creditColumn] || '0').trim().replace(/[,$]/g, '');
        const rawSource = mapping.sourceColumn ? (row[mapping.sourceColumn] || '').trim() : '';

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
          date = parseDate(rawDate, fnsFormat, new Date());
        } else {
          date = new Date(rawDate);
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

            // Apply source tag if provided
            if (sourceTagId) {
              await tx.transactionTag.create({
                data: {
                  transactionId: transaction.id,
                  tagId: sourceTagId,
                },
              });
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
      total: (parseResult.data as Record<string, string>[]).length,
      imported,
      duplicates,
      errors,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Import failed', details: String(e) }, { status: 500 });
  }
}
