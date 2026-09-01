export class AgentOutputFormatError extends Error {
  readonly code = 'PROVIDER_OUTPUT_INVALID';

  constructor(message: string) {
    super(message);
    this.name = 'AgentOutputFormatError';
  }
}

function invalidOutputMessage(kind: 'empty' | 'invalid') {
  return kind === 'empty'
    ? 'The AI provider returned an empty response. Try again; if this continues, verify the configured model and API base URL.'
    : 'The AI provider returned incomplete or invalid JSON. Try again; if this continues, verify the model supports the configured output limit.';
}

export function parseAgentOutputJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new AgentOutputFormatError(invalidOutputMessage('empty'));

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        // Report one stable provider-output error below.
      }
    }
    throw new AgentOutputFormatError(invalidOutputMessage('invalid'));
  }
}
