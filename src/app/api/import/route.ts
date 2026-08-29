import { NextRequest, NextResponse } from 'next/server';
import { checkCsvRequest, importMappingSchema, parseCsvFile } from '@/lib/csv-import';
import { prisma } from '@/lib/prisma';

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
    const parsedRows = await parseCsvFile(file, mapping.data);
    const validRows = parsedRows.filter((row) => !row.error && row.dateValue);
    const tagIds = [
      ...(mapping.data.sourceTagId ? [mapping.data.sourceTagId] : []),
      ...Object.values(mapping.data.sourceValueTagMap),
    ];
    const uniqueTagIds = [...new Set(tagIds)];
    const sourceTags = await prisma.tag.findMany({
      where: { id: { in: uniqueTagIds }, isSource: true },
      select: { id: true },
    });
    if (sourceTags.length !== uniqueTagIds.length) {
      return NextResponse.json(
        { error: 'Every configured source tag must exist and be a source tag' },
        { status: 400 },
      );
    }

    const existing = new Set<string>();
    for (let offset = 0; offset < validRows.length; offset += 500) {
      const found = await prisma.transaction.findMany({
        where: {
          importKey: { in: validRows.slice(offset, offset + 500).map((row) => row.importKey) },
        },
        select: { importKey: true },
      });
      for (const transaction of found) {
        if (transaction.importKey) existing.add(transaction.importKey);
      }
    }
    const newRows = validRows.filter((row) => !existing.has(row.importKey));
    const transactionRows = newRows.map((row) => ({ row, id: crypto.randomUUID() }));

    await prisma.$transaction(
      async (tx) => {
        if (transactionRows.length) {
          await tx.transaction.createMany({
            data: transactionRows.map(({ id, row }) => ({
              id,
              date: row.dateValue!,
              name: row.name,
              normalizedName: row.normalizedName,
              debit: row.debitCents,
              credit: row.creditCents,
              source: row.source,
              csvHash: row.csvHash,
              importKey: row.importKey,
            })),
          });
          const transactionTags = transactionRows.flatMap(({ id, row }) => {
            const rowTagIds = [
              ...(mapping.data.sourceTagId ? [mapping.data.sourceTagId] : []),
              ...(row.source && mapping.data.sourceValueTagMap[row.source]
                ? [mapping.data.sourceValueTagMap[row.source]]
                : []),
            ];
            return [...new Set(rowTagIds)].map((tagId) => ({ transactionId: id, tagId }));
          });
          if (transactionTags.length) await tx.transactionTag.createMany({ data: transactionTags });
        }
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    return NextResponse.json({
      total: parsedRows.length,
      imported: transactionRows.length,
      duplicates: validRows.length - newRows.length,
      errors: parsedRows.length - validRows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
