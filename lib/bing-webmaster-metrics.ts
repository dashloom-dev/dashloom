export type BingTrafficRow = { Clicks?: number; Date?: string; Impressions?: number };
export type BingDimensionRow = BingTrafficRow & { AvgClickPosition?: number; AvgImpressionPosition?: number; Page?: string; Query?: string; Url?: string };

export function parseBingDate(value?: string | null) {
  if (!value) return null;
  const legacy = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/.exec(value);
  const date = legacy ? new Date(Number(legacy[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function bingTrafficPoints(rows: BingTrafficRow[], minimumDate: string, collectedAt: string) {
  return rows.flatMap((row) => {
    const metricDate = parseBingDate(row.Date);
    if (!metricDate || metricDate < minimumDate) return [];
    const clicks = Number(row.Clicks || 0);
    const impressions = Number(row.Impressions || 0);
    return [
      { metric: 'clicks', metricDate, value: clicks, dimensionsJson: '{}', collectedAt },
      { metric: 'impressions', metricDate, value: impressions, dimensionsJson: '{}', collectedAt },
      { metric: 'ctr', metricDate, value: impressions ? clicks / impressions : 0, dimensionsJson: '{}', collectedAt },
    ];
  });
}

function dimensionPoints(rows: BingDimensionRow[], minimumDate: string, collectedAt: string, dimension: 'query' | 'page') {
  return rows.flatMap((row) => {
    const metricDate = parseBingDate(row.Date);
    const label = (dimension === 'query' ? row.Query : row.Url || row.Page || row.Query)?.trim();
    if (!metricDate || metricDate < minimumDate || !label) return [];
    const dimensionsJson = JSON.stringify({ [dimension]: label });
    return [
      { metric: `${dimension}_clicks`, metricDate, value: Number(row.Clicks || 0), dimensionsJson, collectedAt },
      { metric: `${dimension}_impressions`, metricDate, value: Number(row.Impressions || 0), dimensionsJson, collectedAt },
      { metric: `${dimension}_position`, metricDate, value: Number(row.AvgImpressionPosition ?? row.AvgClickPosition ?? 0), dimensionsJson, collectedAt },
    ];
  });
}

export function bingQueryPoints(rows: BingDimensionRow[], minimumDate: string, collectedAt: string) { return dimensionPoints(rows, minimumDate, collectedAt, 'query'); }
export function bingPagePoints(rows: BingDimensionRow[], minimumDate: string, collectedAt: string) { return dimensionPoints(rows, minimumDate, collectedAt, 'page'); }
