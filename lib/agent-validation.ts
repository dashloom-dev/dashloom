type CitationFinding = { title: string; detail?: string; productId?: string | null; evidenceRefs: string[] };
type CitationEvidence = { products?: Array<{ id: string }>; series: Array<{ evidenceId: string; dimension?: { type: 'query' | 'page'; label: string } | null }>; competitors: Array<{ evidenceId: string }>; competitorTrends?: Array<{ evidenceId: string }>; crossSignals?: Array<{ evidenceId: string }>; healthScores?: Array<{ evidenceId: string }>; goals?: Array<{ evidenceId: string }>; missions?: Array<{ evidenceId: string }>; truncated?: { metrics?: boolean; breakdowns?: boolean; competitors?: boolean } };

export function validateAgentCitations<T extends { findings: CitationFinding[] }>(result: T, evidence: CitationEvidence): T {
  const allowed = new Set([...evidence.series, ...evidence.competitors, ...(evidence.competitorTrends || []), ...(evidence.crossSignals || []), ...(evidence.healthScores || []), ...(evidence.goals || []), ...(evidence.missions || [])].map((item) => item.evidenceId));
  const productIds = new Set((evidence.products || []).map((product) => product.id));
  const relationships = new Set((evidence.crossSignals || []).map((item) => item.evidenceId));
  for (const finding of result.findings) {
    if (finding.productId && !productIds.has(finding.productId)) throw new Error(`Finding "${finding.title}" references an unknown product.`);
    if (!finding.evidenceRefs.length) throw new Error(`Finding "${finding.title}" does not cite evidence.`);
    const invalid = finding.evidenceRefs.filter((reference) => !allowed.has(reference));
    if (invalid.length) throw new Error(`Finding "${finding.title}" cites unknown evidence: ${invalid.join(', ')}`);
    if (finding.evidenceRefs.some((reference) => relationships.has(reference)) && !/(?:\bhypothesis\b|假设)/i.test(`${finding.title} ${finding.detail || ''}`)) throw new Error(`Finding "${finding.title}" must label relationship evidence as a hypothesis.`);
  }
  if ((evidence.truncated?.metrics || evidence.truncated?.breakdowns || evidence.truncated?.competitors) && !/(?:\bincomplete\b|\bpartial\b|\btruncated\b|不完整|部分数据|已截断)/i.test(result.findings.map((finding) => `${finding.title} ${finding.detail || ''}`).join(' '))) throw new Error('Truncated evidence must be disclosed as incomplete in the Agent output.');
  return result;
}
