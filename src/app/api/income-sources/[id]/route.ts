import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { incomeSourceMoneyFromCents } from '@/lib/api-formatters';
import {
  budgetPeriodSchema,
  nameSchema,
  nonNegativeMoneyInputSchema,
  orderSchema,
  readJson,
} from '@/lib/api-validation';
import { toCents } from '@/lib/money';
import { prisma } from '@/lib/prisma';

const updateIncomeSourceSchema = z
  .object({
    name: nameSchema.optional(),
    netAmount: nonNegativeMoneyInputSchema.optional(),
    netPeriod: budgetPeriodSchema.optional(),
    grossAmount: nonNegativeMoneyInputSchema.nullable().optional(),
    grossPeriod: budgetPeriodSchema.nullable().optional(),
    order: orderSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = await readJson(request, updateIncomeSourceSchema);
  if (!parsed.success) return parsed.response;
  const value = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.incomeSource.findUnique({ where: { id } });
      if (!current) return null;
      const resultingGrossAmount =
        value.grossAmount === undefined ? current.grossAmount : value.grossAmount;
      const resultingGrossPeriod =
        value.grossAmount === null
          ? null
          : value.grossPeriod === undefined
            ? current.grossPeriod
            : value.grossPeriod;
      if (resultingGrossAmount !== null && resultingGrossPeriod === null) {
        throw new TypeError('grossPeriod is required when grossAmount is provided');
      }
      if (resultingGrossAmount === null && resultingGrossPeriod !== null) {
        throw new TypeError('grossPeriod cannot be set without grossAmount');
      }
      return tx.incomeSource.update({
        where: { id },
        data: {
          ...(value.name !== undefined && { name: value.name }),
          ...(value.netAmount !== undefined && { netAmount: toCents(value.netAmount) }),
          ...(value.netPeriod !== undefined && { netPeriod: value.netPeriod }),
          ...(value.grossAmount !== undefined && {
            grossAmount: value.grossAmount === null ? null : toCents(value.grossAmount),
            ...(value.grossAmount === null && { grossPeriod: null }),
          }),
          ...(value.grossPeriod !== undefined && { grossPeriod: value.grossPeriod }),
          ...(value.order !== undefined && { order: value.order }),
        },
      });
    });
    if (!updated) return NextResponse.json({ error: 'Income source not found' }, { status: 404 });
    return NextResponse.json(incomeSourceMoneyFromCents(updated));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update income source' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await prisma.incomeSource.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Unable to delete income source' }, { status: 500 });
  }
}
