export type AnalysisTrigger = 'chat' | 'manual' | 'daily' | 'weekly' | 'monthly' | 'alert';

export function comparisonDays(trigger: AnalysisTrigger) {
  if (trigger === 'daily') return 1;
  if (trigger === 'monthly') return 30;
  return 7;
}

export function comparisonWindow(trigger: AnalysisTrigger) {
  const days = comparisonDays(trigger);
  const currentEndOffset = ['daily', 'weekly', 'monthly'].includes(trigger) ? -1 : 0;
  const splitOffset = currentEndOffset - (days - 1);
  const previousEndOffset = splitOffset - 1;
  const startOffset = previousEndOffset - (days - 1);
  return { days, startOffset, splitOffset, currentEndOffset, previousEndOffset };
}
