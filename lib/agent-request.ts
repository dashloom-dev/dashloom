import { z } from 'zod';

// FormData.get returns null for absent fields; JSON requests use undefined.
export const agentAnalyzeInput = z.object({
  question: z.string().trim().min(3).max(1000),
  preset: z.enum(['portfolio_analyst', 'revenue_analyst', 'seo_growth_analyst', 'operations_analyst', 'client_reporting_analyst']).default('portfolio_analyst'),
  conversationId: z.preprocess((value) => value === '' || value === null ? undefined : value, z.string().uuid().optional()),
  productId: z.preprocess((value) => value === '' ? null : value, z.string().uuid().nullable().optional()),
  stream: z.preprocess((value) => value === null ? undefined : value === 'true' ? true : value === 'false' ? false : value, z.boolean().optional()),
});

export function agentAnalyzeFormInput(form: FormData) {
  return {
    question: form.get('question'),
    preset: form.get('preset') ?? undefined,
    conversationId: form.get('conversationId'),
    productId: form.get('productId'),
    stream: form.get('stream'),
  };
}
