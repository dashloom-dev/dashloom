import { AgentOutputFormatError } from './agent-output.ts';
import { AgentImageValidationError, AgentVisionUnsupportedError } from './agent-images.ts';

export type AgentFailure = {
  code: 'ANALYSIS_CANCELLED' | 'IMAGE_INPUT_INVALID' | 'PROVIDER_VISION_UNSUPPORTED' | 'PROVIDER_OUTPUT_INVALID' | 'PROVIDER_AUTH_FAILED' | 'PROVIDER_REQUEST_REJECTED' | 'PROVIDER_ENDPOINT_NOT_FOUND' | 'PROVIDER_RATE_LIMITED' | 'PROVIDER_TIMEOUT' | 'PROVIDER_UNAVAILABLE' | 'ANALYSIS_FAILED';
  message: string;
  httpStatus: number;
  providerStatus: number | null;
};

function providerStatus(error: unknown) {
  if (!error || typeof error !== 'object') return null;
  const value = (error as { statusCode?: unknown }).statusCode;
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

export function classifyAgentFailure(error: unknown): AgentFailure {
  if (error instanceof Error && error.name === 'AbortError') return { code: 'ANALYSIS_CANCELLED', message: 'Analysis stopped.', httpStatus: 499, providerStatus: null };
  if (error instanceof AgentImageValidationError) return { code: error.code, message: error.message, httpStatus: 400, providerStatus: null };
  if (error instanceof AgentVisionUnsupportedError) return { code: error.code, message: error.message, httpStatus: 422, providerStatus: error.statusCode };
  if (error instanceof AgentOutputFormatError) return { code: error.code, message: error.message, httpStatus: 502, providerStatus: null };

  const status = providerStatus(error);
  if (status === 401 || status === 403) return { code: 'PROVIDER_AUTH_FAILED', message: 'The AI provider rejected the API key. Reconnect the model with a valid key.', httpStatus: 502, providerStatus: status };
  if (status === 400 || status === 422) return { code: 'PROVIDER_REQUEST_REJECTED', message: 'The AI provider rejected the request format. Reconnect the model to validate its endpoint, then try again.', httpStatus: 502, providerStatus: status };
  if (status === 404) return { code: 'PROVIDER_ENDPOINT_NOT_FOUND', message: 'The AI provider endpoint was not found. Check the API base URL and reconnect the model.', httpStatus: 502, providerStatus: status };
  if (status === 429) return { code: 'PROVIDER_RATE_LIMITED', message: 'The AI provider is rate-limited or has insufficient provider credit. Check the provider account and try again.', httpStatus: 503, providerStatus: status };
  if (status !== null && status >= 500) return { code: 'PROVIDER_UNAVAILABLE', message: 'The AI provider is temporarily unavailable. Try again shortly or connect another model.', httpStatus: 503, providerStatus: status };

  const message = error instanceof Error ? error.message : '';
  if (/timeout|timed out|deadline|terminated|network|fetch failed|socket/i.test(message)) return { code: 'PROVIDER_TIMEOUT', message: 'The AI provider did not return a response in time. Try again or connect another model.', httpStatus: 504, providerStatus: status };
  return { code: 'ANALYSIS_FAILED', message: 'The AI provider request failed. Verify the model name, API base URL, and provider account, then try again.', httpStatus: 502, providerStatus: status };
}
