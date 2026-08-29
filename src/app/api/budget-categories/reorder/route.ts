import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { idSchema, orderSchema, readJson } from '@/lib/api-validation';
import { prisma } from '@/lib/prisma';

const schema = z
  .object({
    updates: z
      .array(z.object({ id: idSchema, order: orderSchema }).strict())
      .min(1)
      .max(500),
  })
  .strict()
  .refine(
    (value) => new Set(value.updates.map((item) => item.id)).size === value.updates.length,
    'Duplicate ids are not allowed',
  )
  .refine(
    (value) => new Set(value.updates.map((item) => item.order)).size === value.updates.length,
    'Duplicate order values are not allowed',
  );

export async function PATCH(request: NextRequest) {
  const body = await readJson(request, schema);
  if (!body.success) return body.response;
  const categories = await prisma.budgetCategory.findMany({
    where: { id: { in: body.data.updates.map((item) => item.id) } },
    select: { id: true, budgetId: true },
  });
  if (
    categories.length !== body.data.updates.length ||
    new Set(categories.map((category) => category.budgetId)).size !== 1
  ) {
    return NextResponse.json(
      { error: 'Categories must exist in the same budget' },
      { status: 400 },
    );
  }
  await prisma.$transaction(
    body.data.updates.map(({ id, order }) =>
      prisma.budgetCategory.update({ where: { id }, data: { order } }),
    ),
  );
  return NextResponse.json({ success: true });
}
