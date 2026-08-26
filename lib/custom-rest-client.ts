import { customRestHeaders, parseCustomMetricPayload, validateCustomRestConfiguration, type CustomRestConfiguration } from './custom-rest-contract.ts';
import { assertSafeRemoteUrl } from './safe-url.ts';

const MAX_RESPONSE_BYTES = 1024 * 1024;

async function readBoundedJson(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) throw new Error('Custom REST endpoint must return application/json.');
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_RESPONSE_BYTES) throw new Error('Custom REST response exceeds the 1 MiB limit.');
  if (!response.body) throw new Error('Custom REST endpoint returned an empty response.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error('Custom REST response exceeds the 1 MiB limit.'); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; } catch { throw new Error('Custom REST endpoint returned invalid JSON.'); }
}

export async function fetchCustomRestMetrics(configuration: CustomRestConfiguration, secret?: string, dependencies: { validateUrl?: typeof assertSafeRemoteUrl; fetcher?: typeof fetch } = {}) {
  const endpointUrl = validateCustomRestConfiguration(configuration.endpointUrl, { authType: configuration.authType, headerName: configuration.headerName, secret });
  const endpoint = await (dependencies.validateUrl || assertSafeRemoteUrl)(endpointUrl, 'Custom REST endpoint');
  const response = await (dependencies.fetcher || fetch)(endpoint, { method: 'GET', headers: customRestHeaders({ authType: configuration.authType, headerName: configuration.headerName, secret }), redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Custom REST endpoint returned HTTP ${response.status}. Check its credential and availability.`);
  return parseCustomMetricPayload(await readBoundedJson(response));
}
