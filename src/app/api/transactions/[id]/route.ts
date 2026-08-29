import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { transactionMoneyFromCents } from '@/lib/api-formatters';
import { notesSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const updateSchema = z
  .object({ notes: notesSchema.optional(), archived: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nothing to update');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request, updateSchema);
  if (!body.success) return body.response;
  try {
    return NextResponse.json(
      transactionMoneyFromCents(
        await prisma.transaction.update({ where: { id }, data: body.data }),
      ),
    );
  } catch {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }
}
