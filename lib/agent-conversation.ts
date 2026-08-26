export type ConversationRunSnapshot = {
  evidenceJson: string;
  findingsJson: string | null;
};

export type ConversationTurn = {
  question: string;
  summary: string;
  findings: Array<{ title: string; action: string }>;
};

/** Build a small continuity window without carrying historical citations or raw evidence forward. */
export function buildConversationHistory(runs: ConversationRunSnapshot[]): ConversationTurn[] {
  return [...runs].slice(0, 4).reverse().flatMap((run) => {
    try {
      const previousEvidence = JSON.parse(run.evidenceJson) as { request?: { question?: unknown } };
      const previousResult = JSON.parse(run.findingsJson || '{}') as {
        summary?: unknown;
        findings?: Array<{ title?: unknown; action?: unknown }>;
      };
      if (typeof previousEvidence.request?.question !== 'string' || typeof previousResult.summary !== 'string') return [];
      return [{
        question: previousEvidence.request.question.slice(0, 500),
        summary: previousResult.summary.slice(0, 800),
        findings: Array.isArray(previousResult.findings)
          ? previousResult.findings.slice(0, 5).map((finding) => ({
              title: typeof finding.title === 'string' ? finding.title.slice(0, 160) : '',
              action: typeof finding.action === 'string' ? finding.action.slice(0, 300) : '',
            }))
          : [],
      }];
    } catch {
      return [];
    }
  });
}
