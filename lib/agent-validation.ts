type CitationFinding = { title: string; detail?: string; productId?: string | null; evidenceRefs: string[] };
type CitationReasoningStep = { title: string; detail?: string; evidenceRefs: string[] };
type CitationEvidence = { products?: Array<{ id: string }>; series: Array<{ evidenceId: string; dimension?: { type: 'query' | 'page'; label: string } | null }>; competitors: Array<{ evidenceId: string }>; competitorTrends?: Array<{ evidenceId: string }>; crossSignals?: Array<{ evidenceId: string }>; healthScores?: Array<{ evidenceId: string }>; goals?: Array<{ evidenceId: string }>; missions?: Array<{ evidenceId: string }>; images?: Array<{ evidenceId: string }>; truncated?: { metrics?: boolean; breakdowns?: boolean; competitors?: boolean } };

const incompleteCoveragePattern = /(?:\bincomplete\b|\bpartial\b|\btruncated\b|\blimited coverage\b|不完整|部分(?:[^。；，,.]{0,12})?数据|已截断|覆盖(?:范围)?(?:有限|受限)|仅覆盖|只覆盖)/i;

export function ensureAgentEvidenceDisclosure<T extends { findings: CitationFinding[] }>(result: T, evidence: CitationEvidence): T {
  const truncated = evidence.truncated?.metrics || evidence.truncated?.breakdowns || evidence.truncated?.competitors;
  if (!truncated || incompleteCoveragePattern.test(result.findings.map((finding) => `${finding.title} ${finding.detail || ''}`).join(' ')) || !result.findings.length) return result;
  const chinese = /[\u3400-\u9fff]/u.test(result.findings.map((finding) => `${finding.title} ${finding.detail || ''}`).join(' '));
  const disclosure = chinese ? '本次分析仅覆盖系统提供的部分数据，未出现的记录不能视为零。' : 'This analysis covers only the partial evidence supplied by the system; absent records must not be treated as zero.';
  return { ...result, findings: result.findings.map((finding, index) => index === 0 ? { ...finding, detail: `${finding.detail || ''}${finding.detail ? ' ' : ''}${disclosure}` } : finding) };
}

export function validateAgentCitations<T extends { findings: CitationFinding[]; reasoningSummary?: CitationReasoningStep[] }>(result: T, evidence: CitationEvidence): T {
  const allowed = new Set([...evidence.series, ...evidence.competitors, ...(evidence.competitorTrends || []), ...(evidence.crossSignals || []), ...(evidence.healthScores || []), ...(evidence.goals || []), ...(evidence.missions || []), ...(evidence.images || [])].map((item) => item.evidenceId));
  const productIds = new Set((evidence.products || []).map((product) => product.id));
  const relationships = new Set((evidence.crossSignals || []).map((item) => item.evidenceId));
  for (const finding of result.findings) {
    if (finding.productId && !productIds.has(finding.productId)) throw new Error(`Finding "${finding.title}" references an unknown product.`);
    if (!finding.evidenceRefs.length) throw new Error(`Finding "${finding.title}" does not cite evidence.`);
    const invalid = finding.evidenceRefs.filter((reference) => !allowed.has(reference));
    if (invalid.length) throw new Error(`Finding "${finding.title}" cites unknown evidence: ${invalid.join(', ')}`);
    if (finding.evidenceRefs.some((reference) => relationships.has(reference)) && !/(?:\bhypothesis\b|假设)/i.test(`${finding.title} ${finding.detail || ''}`)) throw new Error(`Finding "${finding.title}" must label relationship evidence as a hypothesis.`);
  }
  for (const step of result.reasoningSummary || []) {
    if (!step.evidenceRefs.length) throw new Error(`Reasoning summary "${step.title}" does not cite evidence.`);
    const invalid = step.evidenceRefs.filter((reference) => !allowed.has(reference));
    if (invalid.length) throw new Error(`Reasoning summary "${step.title}" cites unknown evidence: ${invalid.join(', ')}`);
    if (step.evidenceRefs.some((reference) => relationships.has(reference)) && !/(?:\bhypothesis\b|假设)/i.test(`${step.title} ${step.detail || ''}`)) throw new Error(`Reasoning summary "${step.title}" must label relationship evidence as a hypothesis.`);
  }
  if ((evidence.truncated?.metrics || evidence.truncated?.breakdowns || evidence.truncated?.competitors) && !incompleteCoveragePattern.test(result.findings.map((finding) => `${finding.title} ${finding.detail || ''}`).join(' '))) throw new Error('Truncated evidence must be disclosed as incomplete in the Agent output.');
  return result;
}
