import { z } from 'zod';

const nullableText = z.string().max(100).nullable(); const timestamp = z.string().max(40).nullable(); const count = z.number().int().nonnegative();
export const anonymousDiagnosticsSchema = z.object({
  schemaVersion: z.literal(1), generatedAt: z.string().max(40),
  application: z.object({ name: z.literal('Dashloom'), version: z.string().max(40) }).strict(),
  workspace: z.object({ plan: z.string().max(40), products: count, members: count }).strict(),
  connectors: z.array(z.object({ provider: z.string().max(80), status: z.string().max(40), count }).strict()).max(100),
  metrics: z.object({ points: count, freshThrough: timestamp, sources: z.array(z.object({ source: z.string().max(80), count }).strict()).max(100) }).strict(),
  synchronization: z.array(z.object({ source: z.string().max(80), status: z.string().max(40), errorCode: nullableText, recordsWritten: count, startedAt: timestamp, finishedAt: timestamp }).strict()).max(20),
  agent: z.array(z.object({ trigger: z.string().max(40), status: z.string().max(40), errorCode: nullableText, createdAt: z.string().max(40), finishedAt: timestamp }).strict()).max(10),
  reports: z.array(z.object({ cadence: z.string().max(40), status: z.string().max(40), periodEnd: z.string().max(40), createdAt: z.string().max(40) }).strict()).max(10),
  privacy: z.object({ excluded: z.array(z.string().max(100)).min(1).max(30) }).strict(),
}).strict();

export type AnonymousDiagnostics = z.infer<typeof anonymousDiagnosticsSchema>;
