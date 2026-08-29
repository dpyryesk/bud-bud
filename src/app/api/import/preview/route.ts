import { NextRequest, NextResponse } from 'next/server';
import {
  checkCsvRequest,
  importMappingSchema,
  parseCsvFile,
  type ParsedCsvRow,
} from '@/lib/csv-import';
import { prisma } from '@/lib/prisma';

async function existingImportKeys(rows: ParsedCsvRow[]) {
  const keys = rows.map((row) => row.importKey);
  const found = new Set<string>();
  for (let offset = 0; offset < keys.length; offset += 500) {
    const transactions = await prisma.transaction.findMany({
      where: { importKey: { in: keys.slice(offset, offset + 500) } },
      select: { importKey: true },
    });
    for (const transaction of transactions) {
      if (transaction.importKey) found.add(transaction.importKey);
    }
  }
  return found;
}

export async function POST(request: NextRequest) {
  if (!checkCsvRequest(request)) {
    return NextResponse.json({ error: 'CSV request is too large' }, { status: 413 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const mappingRaw = formData.get('mapping');
    if (!(file instanceof File) || typeof mappingRaw !== 'string') {
      return NextResponse.json({ error: 'File and mapping are required' }, { status: 400 });
    }
    let mappingJson: unknown;
    try {
      mappingJson = JSON.parse(mappingRaw);
    } catch {
      return NextResponse.json({ error: 'Mapping must be valid JSON' }, { status: 400 });
    }
    const mapping = importMappingSchema.safeParse(mappingJson);
    if (!mapping.success) {
      return NextResponse.json(
        { error: 'Invalid mapping', issues: mapping.error.issues.map((issue) => issue.message) },
        { status: 400 },
      );
    }
    const rows = await parseCsvFile(file, mapping.data);
    const existing = await existingImportKeys(rows.filter((row) => !row.error));
    const result = rows.map((row) => {
      const duplicate = existing.has(row.importKey);
      return {
        rowIndex: row.rowIndex,
        date: row.date,
        name: row.name,
        normalizedName: row.normalizedName,
        debit: row.debit,
        credit: row.credit,
        source: row.source,
        csvHash: row.csvHash,
        importKey: row.importKey,
        ...(row.error && { error: row.error }),
        isDuplicate: duplicate,
        isDuplicateInDb: duplicate,
        isDuplicateInCsv: false,
      };
    });
    return NextResponse.json({
      total: result.length,
      newCount: result.filter((row) => !row.error && !row.isDuplicate).length,
      duplicates: result.filter((row) => !row.error && row.isDuplicate).length,
      errors: result.filter((row) => row.error).length,
      rows: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
