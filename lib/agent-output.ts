export class AgentOutputFormatError extends Error {
  readonly code = 'PROVIDER_OUTPUT_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'AgentOutputFormatError';
  }
}

export function normalizeAgentSeverity(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'high') return 'critical';
  if (normalized === 'medium') return 'warning';
  if (normalized === 'low') return 'info';
  return normalized;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function normalizeAgentNumber(value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().replace(/,/g, '').replace(/%$/, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

export function normalizeAgentConfidence(value: unknown): unknown {
  const normalized = normalizeAgentNumber(value);
  return typeof normalized === 'number' && normalized > 1 && normalized <= 100 ? normalized / 100 : normalized;
}

export function normalizeAgentFindingInput(value: unknown): unknown {
  const finding = objectRecord(value);
  if (!finding) return value;
  return {
    ...finding,
    detail: finding.detail ?? finding.description ?? '',
    severity: finding.severity ?? finding.priority ?? 'info',
    metric: finding.metric ?? null,
    productId: finding.productId ?? finding.product_id ?? null,
    currentValue: finding.currentValue ?? finding.current_value ?? null,
    previousValue: finding.previousValue ?? finding.previous_value ?? null,
    changePercent: finding.changePercent ?? finding.change_percent ?? null,
    action: finding.action ?? finding.recommendation ?? finding.nextAction ?? finding.next_action ?? '',
    confidence: finding.confidence ?? 0.5,
    evidenceRefs: finding.evidenceRefs ?? finding.evidence_refs ?? finding.citations ?? [],
  };
}

export function normalizeAgentResultInput(value: unknown): unknown {
  const result = objectRecord(value);
  if (!result) return value;
  return { ...result, summary: result.summary ?? result.overview ?? '', findings: result.findings ?? result.insights ?? result.items };
}

function invalidOutputMessage(kind: 'empty' | 'invalid') {
  return kind === 'empty'
    ? 'The AI provider returned an empty response. Try again; if this continues, verify the configured model and API base URL.'
    : 'The AI provider returned incomplete or invalid JSON. Try again; if this continues, verify the model supports the configured output limit.';
}

function parseJsonCandidate(candidate: string): unknown {
  let value: unknown = JSON.parse(candidate);
  for (let depth = 0; depth < 2 && typeof value === 'string'; depth += 1) {
    const nested = value.trim();
    const fenced = nested.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    value = JSON.parse(fenced || nested);
  }
  return value;
}

export function parseAgentOutputJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new AgentOutputFormatError(invalidOutputMessage('empty'));

  const fenced = trimmed.startsWith('"') ? undefined : trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;

  try {
    return parseJsonCandidate(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return parseJsonCandidate(candidate.slice(start, end + 1));
      } catch {
        // Report one stable provider-output error below.
      }
    }
    throw new AgentOutputFormatError(invalidOutputMessage('invalid'));
  }
}
