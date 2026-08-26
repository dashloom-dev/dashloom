import { validateAgentCitations } from './agent-validation.ts';

export type EvaluationFinding = {
  title: string;
  detail: string;
  action: string;
  confidence: number;
  evidenceRefs: string[];
};

export type EvaluationOutput = { summary: string; findings: EvaluationFinding[] };
export type GoldenCase = {
  id: string;
  preset: string;
  question: string;
  evidence: {
    series: Array<{ evidenceId: string; currency?: string | null }>;
    competitors: Array<{ evidenceId: string }>;
    competitorTrends?: Array<{ evidenceId: string }>;
    crossSignals?: Array<{ evidenceId: string }>;
    healthScores: Array<{ evidenceId: string }>;
    goals?: Array<{ evidenceId: string }>;
  };
  rubric: {
    requiredEvidenceGroups: string[][];
    requiredKeywordGroups: string[][];
    forbiddenPhrases: string[];
    minimumFindings: number;
    minimumConfidence: number;
  };
};

export type EvaluationResult = { caseId: string; passed: boolean; score: number; failures: string[] };

function normalizedText(output: EvaluationOutput) {
  return [output.summary, ...output.findings.flatMap((finding) => [finding.title, finding.detail, finding.action])].join(' ').toLowerCase();
}

export function evaluateAgentOutput(goldenCase: GoldenCase, output: EvaluationOutput): EvaluationResult {
  const failures: string[] = [];
  if (!output.summary?.trim()) failures.push('Summary is empty.');
  if (output.findings.length < goldenCase.rubric.minimumFindings) failures.push(`Expected at least ${goldenCase.rubric.minimumFindings} findings.`);
  if (output.findings.length > 8) failures.push('Output exceeds the eight-finding contract.');
  try { validateAgentCitations(output, goldenCase.evidence); } catch (error) { failures.push(error instanceof Error ? error.message : 'Citation validation failed.'); }

  const cited = new Set(output.findings.flatMap((finding) => finding.evidenceRefs));
  for (const group of goldenCase.rubric.requiredEvidenceGroups) {
    if (!group.some((reference) => cited.has(reference))) failures.push(`Missing required evidence group: ${group.join(' | ')}`);
  }

  const text = normalizedText(output);
  for (const group of goldenCase.rubric.requiredKeywordGroups) {
    if (!group.some((keyword) => text.includes(keyword.toLowerCase()))) failures.push(`Missing required concept: ${group.join(' | ')}`);
  }
  for (const phrase of goldenCase.rubric.forbiddenPhrases) {
    if (text.includes(phrase.toLowerCase())) failures.push(`Contains forbidden unsupported phrase: ${phrase}`);
  }
  if (output.findings.some((finding) => !finding.action.trim())) failures.push('Every finding must include an action.');
  if (output.findings.some((finding) => finding.confidence < goldenCase.rubric.minimumConfidence || finding.confidence > 1)) failures.push('A finding is outside the allowed confidence range.');

  const currencyByEvidence = new Map(goldenCase.evidence.series.map((item) => [item.evidenceId, item.currency || null]));
  for (const finding of output.findings) {
    const currencies = new Set(finding.evidenceRefs.map((reference) => currencyByEvidence.get(reference)).filter((currency): currency is string => Boolean(currency)));
    if (currencies.size > 1) failures.push(`Finding "${finding.title}" combines monetary evidence across currencies.`);
  }

  const checks = 8 + goldenCase.rubric.requiredEvidenceGroups.length + goldenCase.rubric.requiredKeywordGroups.length + goldenCase.rubric.forbiddenPhrases.length;
  return { caseId: goldenCase.id, passed: failures.length === 0, score: Math.max(0, Math.round(((checks - failures.length) / checks) * 100)), failures };
}
