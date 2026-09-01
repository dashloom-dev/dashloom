import { AgentOutputFormatError } from './agent-output.ts';
import type { AgentImageInput } from './agent-images.ts';

export const compatibilityModes = ['auto', 'standard_openai', 'model_endpoint'] as const;
export type CompatibilityMode = typeof compatibilityModes[number];
export const compatibilityProfiles = ['standard_stream', 'standard_json', 'model_endpoint_stream', 'model_endpoint_json'] as const;
export type CompatibilityProfile = typeof compatibilityProfiles[number];
export type ProviderCompatibility = { version: 1; profile: CompatibilityProfile; validatedAt: string };
export type CompatibleAiResult = { text: string; usage: { inputTokens?: number; outputTokens?: number }; finishReason: string };

export class OpenAiCompatibleRequestError extends Error {
  readonly statusCode: number;
  readonly providerCode: string | null;
  constructor(statusCode: number, providerCode: string | null = null) {
    super(`OpenAI-compatible provider returned HTTP ${statusCode}.`);
    this.name = 'OpenAiCompatibleRequestError'; this.statusCode = statusCode; this.providerCode = providerCode;
  }
}

export type CompatibleResponseShape = {
  contentType: string;
  bodyBytes: number;
  payloadCount: number;
  rootKeys: string[];
  nestedKeys: string[];
};

export class OpenAiCompatibleOutputError extends AgentOutputFormatError {
  readonly responseShape: CompatibleResponseShape;

  constructor(responseShape: CompatibleResponseShape) {
    super('The AI provider returned an empty response. Try again; if this continues, verify the configured model and API base URL.');
    this.name = 'OpenAiCompatibleOutputError';
    this.responseShape = responseShape;
  }
}

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null { return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null; }
function number(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function safeProviderCode(value: unknown) { if (typeof value !== 'string' && typeof value !== 'number') return null; const code = String(value).trim(); return /^[A-Za-z0-9_.:-]{1,80}$/.test(code) ? code : null; }
function boundedKeys(value: JsonRecord | null) { return value ? Object.keys(value).sort().slice(0, 20) : []; }
function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  const valueRecord = record(value);
  if (valueRecord) return typeof valueRecord.value === 'string' ? valueRecord.value : typeof valueRecord.text === 'string' ? valueRecord.text : '';
  if (!Array.isArray(value)) return '';
  return value.map((part) => {
    if (typeof part === 'string') return part;
    const item = record(part);
    if (!item || item.thought === true) return '';
    return contentText(item.text) || contentText(item.content) || contentText(item.value);
  }).join('');
}
function payloadVariants(payload: JsonRecord) {
  const variants: JsonRecord[] = [payload];
  for (let index = 0; index < variants.length && index < 8; index += 1) {
    for (const key of ['data', 'result', 'response']) {
      const nested = record(variants[index]?.[key]);
      if (nested && !variants.includes(nested)) variants.push(nested);
    }
  }
  return variants;
}
function responsesOutputText(payload: JsonRecord) {
  if (!Array.isArray(payload.output)) return '';
  return payload.output.map((entry) => {
    const item = record(entry);
    return item ? contentText(item.content) || contentText(item.text) : '';
  }).join('');
}
function textFromPayload(payload: JsonRecord) {
  const choice = Array.isArray(payload.choices) ? record(payload.choices[0]) : null;
  const message = choice ? record(choice.message) : null;
  const delta = choice ? record(choice.delta) : null;
  const candidate = Array.isArray(payload.candidates) ? record(payload.candidates[0]) : null;
  const candidateContent = candidate ? record(candidate.content) : null;
  const parts = candidateContent && Array.isArray(candidateContent.parts) ? candidateContent.parts : [];
  return contentText(message?.content)
    || contentText(delta?.content)
    || contentText(choice?.text)
    || parts.map((part) => { const item = record(part); return item && item.thought !== true ? contentText(item.text) : ''; }).join('')
    || contentText(payload.output_text)
    || responsesOutputText(payload)
    || contentText(payload.text)
    || contentText(message?.reasoning_content)
    || contentText(delta?.reasoning_content);
}
function textFromRoot(payload: JsonRecord) { for (const variant of payloadVariants(payload)) { const text = textFromPayload(variant); if (text) return text; } return ''; }
function finishReasonFromPayload(payload: JsonRecord) { const choice = Array.isArray(payload.choices) ? record(payload.choices[0]) : null; const candidate = Array.isArray(payload.candidates) ? record(payload.candidates[0]) : null; const value = choice?.finish_reason ?? candidate?.finishReason; return typeof value === 'string' ? value : 'unknown'; }
function usageFromPayload(payload: JsonRecord) { const usage = record(payload.usage); const metadata = record(payload.usageMetadata); return { inputTokens: number(usage?.prompt_tokens) ?? number(metadata?.promptTokenCount), outputTokens: number(usage?.completion_tokens) ?? number(metadata?.candidatesTokenCount) }; }
function parseSse(text: string) {
  const payloads: JsonRecord[] = [];
  let dataLines: string[] = [];
  const flush = () => {
    const data = dataLines.join('\n').trim(); dataLines = [];
    if (!data || data === '[DONE]') return;
    try { const value = record(JSON.parse(data)); if (value) payloads.push(value); } catch { /* Ignore non-JSON keepalive events. */ }
  };
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trimStart();
    if (!line) { flush(); continue; }
    if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  flush();
  return payloads;
}
function responseShape(body: string, contentType: string, payloads: JsonRecord[]): CompatibleResponseShape {
  const variants = payloads.flatMap(payloadVariants);
  return {
    contentType: contentType.split(';', 1)[0]?.trim().slice(0, 80) || 'unknown',
    bodyBytes: new TextEncoder().encode(body).byteLength,
    payloadCount: payloads.length,
    rootKeys: [...new Set(payloads.flatMap(boundedKeys))].sort().slice(0, 30),
    nestedKeys: [...new Set(variants.slice(payloads.length).flatMap(boundedKeys))].sort().slice(0, 30),
  };
}

export function parseCompatibleResponseBody(body: string, contentType = 'application/json'): CompatibleAiResult {
  let payloads: JsonRecord[] = [];
  if (contentType.includes('text/event-stream') || /^\s*data:/m.test(body)) payloads = parseSse(body);
  else { try { const value = record(JSON.parse(body)); if (value) payloads = [value]; } catch { /* Report a stable output error below. */ } }
  const variants = payloads.flatMap(payloadVariants);
  const providerError = variants.map((payload) => record(payload.error)).find(Boolean);
  if (providerError) { const status = number(providerError.status) ?? number(providerError.statusCode) ?? number(providerError.code) ?? 502; throw new OpenAiCompatibleRequestError(status, safeProviderCode(providerError.code)); }
  const text = payloads.map(textFromRoot).join('');
  if (!text.trim()) throw new OpenAiCompatibleOutputError(responseShape(body, contentType, payloads));
  const last = variants[variants.length - 1] || {}; const usagePayload = [...variants].reverse().find((payload) => payload.usage || payload.usageMetadata) || last; const finishPayload = [...variants].reverse().find((payload) => finishReasonFromPayload(payload) !== 'unknown') || last;
  return { text, usage: usageFromPayload(usagePayload), finishReason: finishReasonFromPayload(finishPayload) };
}

function profileProperties(profile: CompatibilityProfile) { return { includeModel: profile.startsWith('standard_'), stream: profile.endsWith('_stream') }; }
export function inferredCompatibility(baseUrl: string): ProviderCompatibility { const url = new URL(baseUrl); const modelEndpoint = url.hostname === 'api.kie.ai'; return { version: 1, profile: modelEndpoint ? 'model_endpoint_stream' : 'standard_stream', validatedAt: '' }; }
export function parseProviderCompatibility(value: string | null | undefined, baseUrl: string): ProviderCompatibility { try { const parsed = JSON.parse(value || '{}') as Partial<ProviderCompatibility>; if (parsed.version === 1 && compatibilityProfiles.includes(parsed.profile as CompatibilityProfile)) return { version: 1, profile: parsed.profile as CompatibilityProfile, validatedAt: typeof parsed.validatedAt === 'string' ? parsed.validatedAt : '' }; } catch { /* Existing records are inferred until revalidated. */ } return inferredCompatibility(baseUrl); }

export async function invokeOpenAiCompatible(input: { baseUrl: string; apiKey: string; model: string; system: string; prompt: string; images?: AgentImageInput[]; profile: CompatibilityProfile; abortSignal?: AbortSignal; timeoutMs?: number }) {
  const { includeModel, stream } = profileProperties(input.profile); const signals = [AbortSignal.timeout(input.timeoutMs ?? 60_000), input.abortSignal].filter((signal): signal is AbortSignal => Boolean(signal));
  const userContent = input.images?.length ? [{ type: 'text', text: input.prompt }, ...input.images.map((image) => ({ type: 'image_url', image_url: { url: image.dataUrl, detail: 'high' } }))] : input.prompt;
  const body: Record<string, unknown> = { messages: [{ role: 'system', content: input.system }, { role: 'user', content: userContent }], stream }; if (includeModel) body.model = input.model;
  const response = await fetch(`${input.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${input.apiKey}`, accept: stream ? 'text/event-stream, application/json' : 'application/json', 'content-type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual', signal: signals.length === 1 ? signals[0] : AbortSignal.any(signals) });
  if (response.status >= 300 && response.status < 400) throw new OpenAiCompatibleRequestError(response.status);
  const responseBody = await response.text();
  if (!response.ok) { try { parseCompatibleResponseBody(responseBody, response.headers.get('content-type') || ''); } catch (error) { if (error instanceof OpenAiCompatibleRequestError) throw new OpenAiCompatibleRequestError(response.status, error.providerCode); } throw new OpenAiCompatibleRequestError(response.status); }
  return parseCompatibleResponseBody(responseBody, response.headers.get('content-type') || '');
}

export function compatibleProfileCandidates(mode: CompatibilityMode, baseUrl: string): CompatibilityProfile[] { const inferred = inferredCompatibility(baseUrl).profile.startsWith('model_endpoint'); const standard: CompatibilityProfile[] = ['standard_stream', 'standard_json']; const endpoint: CompatibilityProfile[] = ['model_endpoint_stream', 'model_endpoint_json']; if (mode === 'standard_openai') return standard; if (mode === 'model_endpoint') return endpoint; return inferred ? [...endpoint, ...standard] : [...standard, ...endpoint]; }
function shouldStopProbe(error: unknown) { return error instanceof OpenAiCompatibleRequestError && ([401, 403, 429].includes(error.statusCode) || error.statusCode >= 500); }
export async function detectOpenAiCompatibility(input: { baseUrl: string; apiKey: string; model: string; mode: CompatibilityMode; abortSignal?: AbortSignal }) { let lastError: unknown = new Error('No compatible request profile was accepted.'); for (const profile of compatibleProfileCandidates(input.mode, input.baseUrl)) { try { await invokeOpenAiCompatible({ ...input, profile, system: 'Return only OK.', prompt: 'Reply with OK.', timeoutMs: 12_000 }); return { version: 1, profile, validatedAt: new Date().toISOString() } satisfies ProviderCompatibility; } catch (error) { lastError = error; if (shouldStopProbe(error)) throw error; } } throw lastError; }

export async function invokeOpenAiCompatibleWithFallback(input: { baseUrl: string; apiKey: string; model: string; system: string; prompt: string; images?: AgentImageInput[]; preferredProfile: CompatibilityProfile; allowFallback: boolean; abortSignal?: AbortSignal }) {
  const candidates = input.allowFallback ? [input.preferredProfile, ...compatibleProfileCandidates('auto', input.baseUrl).filter((profile) => profile !== input.preferredProfile)] : [input.preferredProfile];
  let lastError: unknown = new Error('No compatible request profile was accepted.');
  for (const profile of candidates) {
    try { return { ...(await invokeOpenAiCompatible({ ...input, profile })), profile }; }
    catch (error) { lastError = error; if (error instanceof Error && error.name === 'AbortError') throw error; if (shouldStopProbe(error)) throw error; }
  }
  throw lastError;
}
