import { env } from 'cloudflare:workers';

type Envelope = { version: 1; iv: string; ciphertext: string };

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must contain at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string, context: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(context) },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return JSON.stringify({ version: 1, iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) } satisfies Envelope);
}

export async function decryptSecret(envelope: string, context: string) {
  const parsed = JSON.parse(envelope) as Envelope;
  if (parsed.version !== 1) throw new Error('Unsupported encrypted credential version.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(parsed.iv), additionalData: new TextEncoder().encode(context) },
    await encryptionKey(),
    base64ToBytes(parsed.ciphertext),
  );
  return new TextDecoder().decode(plaintext);
}
