export type SeoSeries = {
  productId: string;
  source: string;
  metric: string;
  dimension?: { type: 'query' | 'page'; label: string } | null;
  current: number;
  previous: number;
  currentSamples: number;
  previousSamples: number;
  evidenceId: string;
};

export const SEO_ANALYSIS_POLICY = `For SEO questions, use evidence.seoOpportunities as a deterministic shortlist, not a complete market scan or forecast. Cite its original evidenceRefs, never invent new citation IDs. Thresholds are product heuristics, not Google benchmarks. Position is the existing unweighted average of observed daily positions, not an impression-weighted GSC period position. A smaller position number is better. Do not infer indexing failure from absent clicks. Separate clicks, impressions, CTR and position before proposing a cause. Query and page datasets are separate; never infer a query-to-page mapping. Recommend a concrete experiment, success metric and review period. Demand ideas and translated keyword variants are hypotheses until measured; GSC impressions are not keyword search volume. Do not invent KD, DR, CPC, backlinks, domain age, valuation or live SERP/page audit results. State which missing data is needed for unsupported requests. Never claim to have called external tools: this analysis uses the frozen connected evidence. Answer in the user's language.`;

/** Only derive candidates from the exact scoped, bounded series visible to the model. */
export function buildSeoOpportunities(series: SeoSeries[], periodDays = 7) {
  const groups = new Map<string, SeoSeries[]>();
  for (const row of series) {
    if (!row.dimension || !Number.isFinite(row.current) || !Number.isFinite(row.previous)) continue;
    const key = JSON.stringify([row.productId, row.source, row.dimension.type, row.dimension.label]);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const candidates = [...groups.values()].flatMap((rows) => {
    const first = rows[0];
    const dimension = first.dimension!;
    const metric = (name: string) => rows.find((row) => row.metric === `${dimension.type}_${name}`);
    const clicks = metric('clicks');
    const impressions = metric('impressions');
    const position = metric('position');
    const signals: Array<{ kind: string; evidenceRefs: string[] }> = [];
    // Missing periods must not be interpreted as measured zeros.
    const hasCurrent = (row: SeoSeries | undefined): row is SeoSeries => !!row && row.currentSamples === periodDays && row.current >= 0;
    if (hasCurrent(impressions) && impressions.current >= 100 && hasCurrent(clicks) && clicks.current <= impressions.current && clicks.current / impressions.current < 0.02) {
      signals.push({ kind: 'high_impressions_low_ctr', evidenceRefs: [impressions.evidenceId, clicks.evidenceId] });
    }
    if (hasCurrent(impressions) && impressions.current >= 100 && hasCurrent(position) && position.current >= 4 && position.current <= 20) {
      signals.push({ kind: 'striking_distance', evidenceRefs: [impressions.evidenceId, position.evidenceId] });
    }
    if (hasCurrent(clicks) && clicks.previousSamples === periodDays && clicks.previous >= 10 && clicks.current <= clicks.previous * 0.8) {
      signals.push({ kind: 'click_decline', evidenceRefs: [clicks.evidenceId] });
    }
    return signals.length ? [{
      productId: first.productId, source: first.source, dimension, signals,
      observedCtr: hasCurrent(clicks) && hasCurrent(impressions) && impressions.current > 0 && clicks.current <= impressions.current ? clicks.current / impressions.current : null,
      currentImpressions: hasCurrent(impressions) ? impressions.current : null,
      evidenceRefs: [...new Set(signals.flatMap((signal) => signal.evidenceRefs))],
    }] : [];
  });
  candidates.sort((a, b) => b.signals.length - a.signals.length || (b.currentImpressions || 0) - (a.currentImpressions || 0) || a.dimension.label.localeCompare(b.dimension.label));
  return {
    policyVersion: 1,
    thresholds: { minimumImpressions: 100, lowCtr: 0.02, positionRange: [4, 20], minimumPreviousClicks: 10, clickDeclineFraction: 0.2 },
    limitation: 'Heuristic candidates from supplied query/page series only, requiring a daily sample for the relevant period. Missing periods are not zero. Coverage can be incomplete; observed CTR uses supplied click/impression totals and is not a market benchmark. Daily average position is unweighted. No query-to-page mapping, causal attribution or traffic forecast is available.',
    candidateCount: candidates.length,
    truncated: candidates.length > 12,
    candidates: candidates.slice(0, 12),
  };
}
