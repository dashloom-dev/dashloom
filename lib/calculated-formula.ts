import { z } from 'zod';

const identity = z.string().trim().regex(/^[a-z][a-z0-9_]{0,63}$/);
export const calculatedMetricInput = z.object({
  name: z.string().trim().min(2).max(80), metric: identity,
  leftSource: identity.refine((value) => value !== 'calculated', 'Calculated metrics cannot depend on calculated output.'), leftMetric: identity,
  operator: z.enum(['add', 'subtract', 'multiply', 'divide']),
  rightSource: identity.refine((value) => value !== 'calculated', 'Calculated metrics cannot depend on calculated output.').optional(), rightMetric: identity.optional(),
  constantValue: z.number().finite().min(-1e12).max(1e12).optional(), scale: z.number().finite().min(-1e6).max(1e6).default(1),
}).refine((value) => Boolean(value.rightSource && value.rightMetric) !== (value.constantValue !== undefined), 'Use either a right-side metric or a constant.');

export type FormulaInput = z.infer<typeof calculatedMetricInput>;
export function applyCalculatedFormula(left: { value: number; currency: string | null }, right: { value: number; currency: string | null } | number, operator: FormulaInput['operator'], scale = 1) {
  const rightValue = typeof right === 'number' ? right : right.value; const rightCurrency = typeof right === 'number' ? null : right.currency;
  if (typeof right !== 'number' && ['add', 'subtract'].includes(operator) && left.currency !== rightCurrency) return null;
  if (typeof right !== 'number' && left.currency && rightCurrency && left.currency !== rightCurrency) return null;
  if (typeof right !== 'number' && operator === 'multiply' && left.currency && rightCurrency) return null;
  if (operator === 'divide' && rightValue === 0) return null;
  const raw = operator === 'add' ? left.value + rightValue : operator === 'subtract' ? left.value - rightValue : operator === 'multiply' ? left.value * rightValue : left.value / rightValue;
  const value = raw * scale; if (!Number.isFinite(value)) return null;
  const currency = operator === 'divide' && left.currency && rightCurrency ? null : left.currency || rightCurrency;
  return { value, currency };
}
