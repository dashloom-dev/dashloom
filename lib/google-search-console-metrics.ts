export type GscSearchAnalyticsRow = { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };

export function gscSearchAnalyticsPoints(rows: GscSearchAnalyticsRow[], dimension: 'query' | 'page' | null, truncated: boolean, collectedAt: string) {
  return rows.flatMap((row) => {
    const metricDate = row.keys?.[0];
    const label = dimension ? row.keys?.[1]?.trim() : null;
    if (!metricDate || (dimension && !label)) return [];
    const dimensionsJson = dimension ? JSON.stringify({ [dimension]: label, ...(truncated ? { truncated: true, truncationReason: `gsc_${dimension}_row_cap` } : {}) }) : '{}';
    const prefix = dimension ? `${dimension}_` : '';
    return [
      { metric: `${prefix}clicks`, metricDate, value: Number(row.clicks || 0), dimensionsJson, collectedAt },
      { metric: `${prefix}impressions`, metricDate, value: Number(row.impressions || 0), dimensionsJson, collectedAt },
      { metric: `${prefix}position`, metricDate, value: Number(row.position || 0), dimensionsJson, collectedAt },
      ...(dimension ? [] : [{ metric: 'ctr', metricDate, value: Number(row.ctr || 0), dimensionsJson, collectedAt }]),
    ];
  });
}
