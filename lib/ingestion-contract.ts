import { z } from 'zod';

const metricDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Metric date must be a real YYYY-MM-DD date.');
export const normalizedDimensionValueSchema = z.union([z.string().max(120), z.number().finite(), z.boolean()]);
export const normalizedDimensionKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/).refine((value) => !['email', 'email_address', 'ip', 'ip_address', 'user_id', 'customer_id', 'session_id', 'token', 'secret', 'request_body'].includes(value), 'Raw identity, secret, and request dimensions are not accepted.');
export const normalizedDimensionsSchema = z.record(normalizedDimensionKeySchema, normalizedDimensionValueSchema).superRefine((value, context) => {
  if (Object.keys(value).length > 12) context.addIssue({ code: 'custom', message: 'A metric may contain at most 12 dimensions.' });
});

export const ingestionMetricSchema = z.object({
  productId: z.string().uuid(),
  source: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,39}$/),
  metric: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/),
  metricDate,
  value: z.number().finite(),
  dimensions: normalizedDimensionsSchema.optional().default({}),
}).strict();

export const ingestionPayloadSchema = z.object({ rows: z.array(ingestionMetricSchema).min(1).max(1000) }).strict();
export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
