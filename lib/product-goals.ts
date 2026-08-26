import { addRollupValue, finishRollup, metricRollup, type RollupAccumulator } from './metric-rollup.ts';

export type ProductGoalPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export type ProductGoalDirection = 'at_least' | 'at_most';
export type ProductGoalDefinition = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  metric: string;
  source: string | null;
  currency: string | null;
  direction: ProductGoalDirection;
  period: ProductGoalPeriod;
  targetValue: number;
};
export type ProductGoalMetricPoint = { productId: string; source: string; metric: string; metricDate: string; value: number; dimensionsJson?: string };

const periodDays: Record<ProductGoalPeriod, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 90 };

function day(date: Date, offset: number) {
  return new Date(date.getTime() + offset * 86400000).toISOString().slice(0, 10);
}

function currencyOf(dimensionsJson = '{}') {
  try {
    const currency = (JSON.parse(dimensionsJson) as { currency?: unknown }).currency;
    return typeof currency === 'string' && /^[a-z]{3}$/i.test(currency) ? currency.toLowerCase() : null;
  } catch {
    return null;
  }
}

function emptyRollup(): RollupAccumulator {
  return { sum: 0, count: 0, latestDate: '', latestValue: 0 };
}

export function productGoalWindow(period: ProductGoalPeriod, endDate: string) {
  const end = new Date(`${endDate}T00:00:00Z`);
  return { start: day(end, -(periodDays[period] - 1)), end: endDate, days: periodDays[period] };
}

export function evaluateProductGoals(goals: ProductGoalDefinition[], points: ProductGoalMetricPoint[], endDate: string) {
  return goals.map((goal) => {
    const window = productGoalWindow(goal.period, endDate);
    const accumulator = emptyRollup();
    for (const point of points) {
      if (point.productId !== goal.productId || point.metric !== goal.metric || point.metricDate < window.start || point.metricDate > window.end) continue;
      if (goal.source && point.source !== goal.source) continue;
      if (goal.currency && currencyOf(point.dimensionsJson) !== goal.currency.toLowerCase()) continue;
      addRollupValue(accumulator, point.metricDate, point.value);
    }
    const hasData = accumulator.count > 0;
    const currentValue = hasData ? finishRollup(goal.metric, accumulator) : null;
    const achieved = currentValue !== null && (goal.direction === 'at_least' ? currentValue >= goal.targetValue : currentValue <= goal.targetValue);
    const rawProgress = currentValue === null
      ? null
      : goal.direction === 'at_least'
        ? goal.targetValue === 0 ? 100 : (currentValue / goal.targetValue) * 100
        : currentValue <= goal.targetValue ? 100 : currentValue === 0 ? 100 : (goal.targetValue / currentValue) * 100;
    const progressPercent = rawProgress === null ? null : Math.max(0, Math.min(999, rawProgress));
    const status = currentValue === null ? 'no_data' as const : achieved ? 'achieved' as const : (progressPercent || 0) >= 80 ? 'at_risk' as const : 'off_track' as const;
    return {
      evidenceId: `goal:${goal.id}`,
      goalId: goal.id,
      productId: goal.productId,
      productName: goal.productName,
      name: goal.name,
      metric: goal.metric,
      source: goal.source,
      currency: goal.currency,
      direction: goal.direction,
      period: goal.period,
      rollup: metricRollup(goal.metric),
      targetValue: goal.targetValue,
      currentValue,
      progressPercent,
      status,
      periodStart: window.start,
      periodEnd: window.end,
      latestDate: accumulator.latestDate || null,
    };
  });
}
