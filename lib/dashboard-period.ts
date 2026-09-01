const metricDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function shiftUtcDate(metricDate: string, days: number) {
  const date = new Date(`${metricDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dashboardComparisonWindow(latestMetricDate: string | null | undefined) {
  if (!latestMetricDate || !metricDatePattern.test(latestMetricDate)) return null;
  const parsed = new Date(`${latestMetricDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== latestMetricDate) return null;
  return { start: shiftUtcDate(latestMetricDate, -13), split: shiftUtcDate(latestMetricDate, -6), end: latestMetricDate };
}
