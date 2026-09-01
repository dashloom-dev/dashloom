const blockedNames = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);

function blockedIpv4(hostname: string) {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || (a === 100 && b >= 64 && b <= 127) || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)))) || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113) || a >= 224;
}

function blockedIp(address: string) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (blockedIpv4(value)) return true;
  if (value.includes('.')) {
    const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
    if (mapped) return blockedIpv4(mapped);
  }
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value) || value.startsWith('ff') || value.startsWith('2001:db8:');
}

export function assertSafeHttpsUrl(value: string, purpose = 'URL') {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (url.protocol !== 'https:') throw new Error(`${purpose} must use HTTPS.`);
  if (!url.username && !url.password && !blockedNames.has(hostname) && !hostname.endsWith('.localhost') && !blockedIp(hostname)) return url;
  throw new Error(`${purpose} cannot target credentials, loopback, private, link-local, or reserved hosts.`);
}

export async function assertSafeRemoteUrl(value: string, purpose = 'URL') {
  const url = assertSafeHttpsUrl(value, purpose);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return url;
  const answers = await Promise.all(['A', 'AAAA'].map(async (type) => {
    const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`, { headers: { accept: 'application/dns-json' }, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`${purpose} DNS validation returned HTTP ${response.status}.`);
    const payload = await response.json() as { Answer?: Array<{ type?: number; data?: string }> };
    return (payload.Answer || []).filter((answer) => answer.type === 1 || answer.type === 28).map((answer) => answer.data || '');
  }));
  const addresses = answers.flat().filter(Boolean);
  if (!addresses.length) throw new Error(`${purpose} hostname did not resolve to a public IP address.`);
  if (addresses.some(blockedIp)) throw new Error(`${purpose} hostname resolves to a private, link-local, or reserved address.`);
  return url;
}
