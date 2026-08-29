import { NextResponse } from 'next/server';
import { z } from 'zod';
import { MAX_MONEY_CENTS } from '@/lib/money';
import { MAX_REGEX_PATTERN_LENGTH } from '@/lib/safe-regex';

const MAX_JSON_BYTES = 64 * 1024;

export const idSchema = z.string().trim().min(1).max(128);
export const nameSchema = z.string().trim().min(1).max(200);
export const notesSchema = z.string().max(5_000);
export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a 6-digit hex value');
export const budgetPeriodSchema = z.enum(['monthly', 'biweekly', 'yearly']);
export const matchTypeSchema = z.enum(['exact', 'regex']);
export const orderSchema = z.number().int().min(0).max(100_000);
export const tagIdsSchema = z
  .array(idSchema)
  .max(200)
  .transform((ids) => [...new Set(ids)]);

export const moneyInputSchema = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .regex(/^-?\d+(?:\.\d{1,2})?$/, 'amount must have at most 2 decimals'),
  ])
  .transform(Number)
  .refine(Number.isFinite, 'amount must be finite')
  .refine((value) => Math.abs(value * 100) <= MAX_MONEY_CENTS, 'amount is too large');

export const nonNegativeMoneyInputSchema = moneyInputSchema.refine(
  (value) => value >= 0,
  'amount cannot be negative',
);

export const dateOnlySchema = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}, 'date must be a real calendar date in YYYY-MM-DD format');

export const regexPatternSchema = z.string().trim().min(1).max(MAX_REGEX_PATTERN_LENGTH);

export type JsonReadResult<T> =
  | { success: true; data: T }
  | { success: false; response: NextResponse };

export async function readJson<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = MAX_JSON_BYTES,
): Promise<JsonReadResult<T>> {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Request body is too large' }, { status: 413 }),
    };
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return {
        success: false,
        response: NextResponse.json({ error: 'Request body is too large' }, { status: 413 }),
      };
    }
    body = JSON.parse(text);
  } catch {
    return {
      success: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Invalid request', issues: result.error.issues.map((issue) => issue.message) },
        { status: 400 },
      ),
    };
  }
  return { success: true, data: result.data };
}

export function parseDateRange(
  searchParams: URLSearchParams,
): { success: true; start: Date; end: Date } | { success: false; response: NextResponse } {
  const result = z
    .object({ start: dateOnlySchema, end: dateOnlySchema })
    .safeParse({ start: searchParams.get('start'), end: searchParams.get('end') });
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json({ error: 'start and end must be valid dates' }, { status: 400 }),
    };
  }
  const start = new Date(`${result.data.start}T00:00:00.000Z`);
  const end = new Date(`${result.data.end}T23:59:59.999Z`);
  if (start > end) {
    return {
      success: false,
      response: NextResponse.json({ error: 'start must be on or before end' }, { status: 400 }),
    };
  }
  return { success: true, start, end };
}
