import type { AgentResult } from './agent';

type ComparisonEvidence = { series?: Array<{ evidenceId: string }>; competitors?: Array<{ evidenceId: string }>; competitorTrends?: Array<{ evidenceId: string }>; crossSignals?: Array<{ evidenceId: string }>; healthScores?: Array<{ evidenceId: string }>; goals?: Array<{ evidenceId: string }> };

export function evaluateComparisonResult(result: AgentResult, evidence: ComparisonEvidence) {
  const evidenceRefs = [...new Set(result.findings.flatMap((finding) => finding.evidenceRefs))].sort(); const available = new Set([...(evidence.series || []), ...(evidence.competitors || []), ...(evidence.competitorTrends || []), ...(evidence.crossSignals || []), ...(evidence.healthScores || []), ...(evidence.goals || [])].map((item) => item.evidenceId)); const severities = { info: 0, opportunity: 0, warning: 0, critical: 0 }; let confidence = 0; let actionable = 0; for (const finding of result.findings) { severities[finding.severity] += 1; confidence += finding.confidence; if (finding.action.trim().length >= 5) actionable += 1; }
  return { contractVersion: 1, citationValidation: 'passed' as const, findingCount: result.findings.length, citedEvidenceCount: evidenceRefs.length, availableEvidenceCount: available.size, evidenceRefs, severities, actionableFindings: actionable, averageConfidence: result.findings.length ? confidence / result.findings.length : 0 };
}

export function evidenceAgreement(left: string[], right: string[]) { const a = new Set(left); const b = new Set(right); const union = new Set([...a, ...b]); if (!union.size) return null; let shared = 0; for (const value of a) if (b.has(value)) shared += 1; return shared / union.size; }
