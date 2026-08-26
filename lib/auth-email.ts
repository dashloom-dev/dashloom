import { env } from 'cloudflare:workers';
import { assertSafeRemoteUrl } from './safe-url';

export async function sendAuthEmail(input: { to: string; subject: string; text: string }) {
  const configuration = env as unknown as { AUTH_EMAIL_WEBHOOK_URL?: string; AUTH_EMAIL_WEBHOOK_SECRET?: string };
  if (!configuration.AUTH_EMAIL_WEBHOOK_URL) throw new Error('AUTH_EMAIL_WEBHOOK_URL is not configured.');
  const url = await assertSafeRemoteUrl(configuration.AUTH_EMAIL_WEBHOOK_URL, 'Authentication email webhook');
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(configuration.AUTH_EMAIL_WEBHOOK_SECRET ? { authorization: `Bearer ${configuration.AUTH_EMAIL_WEBHOOK_SECRET}` } : {}) }, body: JSON.stringify({ event: 'dashloom.auth.email', ...input }), redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Authentication email webhook returned HTTP ${response.status}.`);
}
