import { z } from 'zod';
import { idSchema, nameSchema } from '@/lib/api-validation';

const column = z
  .union([z.literal(''), z.literal('none'), z.coerce.number().int().min(1).max(200)])
  .transform(String);

export const savedCsvMappingSchema = z
  .object({
    name: nameSchema,
    dateColumn: column.refine((value) => value !== '' && value !== 'none'),
    nameColumn: column.refine((value) => value !== '' && value !== 'none'),
    debitColumn: column,
    creditColumn: column,
    sourceColumn: column.default(''),
    dateFormat: z.enum(['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'MM-DD-YYYY']),
    skipFirstRow: z.boolean(),
    sourceTagId: idSchema.nullable(),
    sourceValueTagMap: z.record(z.string().min(1).max(10_000), idSchema).default({}),
  })
  .strict()
  .refine(
    (value) => value.debitColumn !== 'none' || value.creditColumn !== 'none',
    'At least one amount column is required',
  );
