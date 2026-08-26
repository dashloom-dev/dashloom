import { z } from 'zod';
import { normalizedDimensionsSchema } from './ingestion-contract.ts';

const metricDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, 'metric date must be a real YYYY-MM-DD date');

export const customMetricPayloadSchema = z.object({
  version: z.literal(1),
  truncated: z.boolean().optional().default(false),
  metrics: z.array(z.object({ metric: z.string().trim().regex(/^[a-z][a-z0-9_]{1,79}$/), date: metricDate, value: z.number().finite(), unit: z.string().trim().regex(/^[A-Za-z0-9_%/.-]{1,24}$/).optional(), domain: z.enum(['commercial', 'acquisition', 'search', 'delivery', 'operations', 'product']).optional(), dimensions: normalizedDimensionsSchema.optional().default({}) }).strict()).min(1).max(500),
}).strict();

export type CustomRestAuth = { authType: 'none' | 'bearer' | 'api_key'; secret?: string; headerName?: string };
export type CustomRestConfiguration = { endpointUrl: string; authType: CustomRestAuth['authType']; headerName?: string };

export function parseCustomMetricPayload(value: unknown, now = new Date()) {
  const parsed = customMetricPayloadSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Custom REST response does not match contract v1: ${parsed.error.issues[0]?.message || 'invalid payload'}.`);
  const today = now.toISOString().slice(0, 10);
  if (parsed.data.metrics.some((metric) => metric.date > today)) throw new Error('Custom REST response contains a future metric date.');
  return parsed.data;
}

export function validateCustomRestConfiguration(endpointValue: string, auth: CustomRestAuth) {
  const endpoint = new URL(endpointValue);
  if (endpoint.search || endpoint.hash) throw new Error('Custom REST endpoint must not contain query parameters or a fragment. Put credentials in the authentication fields.');
  if (auth.authType !== 'none' && !auth.secret?.trim()) throw new Error('A credential is required for the selected authentication method.');
  if (auth.authType === 'api_key' && !/^X-[A-Za-z0-9-]{1,60}$/.test(auth.headerName || '')) throw new Error('API key header must be a custom X- header, for example X-API-Key.');
  return endpoint.toString();
}

export function customRestHeaders(auth: CustomRestAuth) {
  const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'Dashloom-Custom-REST/1' };
  if (auth.authType === 'bearer') headers.authorization = `Bearer ${auth.secret}`;
  if (auth.authType === 'api_key' && auth.headerName) headers[auth.headerName] = auth.secret || '';
  return headers;
}
