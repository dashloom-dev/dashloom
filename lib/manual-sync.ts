export type ManualSyncTarget = { endpoint: string; label: string };

const targets: Record<string, { path: string; label: string; member?: boolean }> = {
  cloudflare: { path: 'cloudflare', label: 'Cloudflare Workers', member: true },
  cloudflare_r2: { path: 'cloudflare-r2', label: 'Cloudflare R2' },
  cloudflare_pages: { path: 'cloudflare-pages', label: 'Cloudflare Pages' },
  cloudflare_queues: { path: 'cloudflare-queues', label: 'Cloudflare Queues' },
  google: { path: 'google', label: 'Google Analytics / Search Console', member: true },
  bing: { path: 'bing', label: 'Bing', member: true },
  d1: { path: 'd1', label: 'D1', member: true },
  github: { path: 'github', label: 'GitHub', member: true },
  vercel: { path: 'vercel', label: 'Vercel', member: true },
  custom: { path: 'custom-rest', label: 'Custom REST', member: true },
  stripe: { path: 'stripe', label: 'Stripe' },
  lemonsqueezy: { path: 'lemonsqueezy', label: 'Lemon Squeezy' },
  creem: { path: 'creem', label: 'Creem' },
  polar: { path: 'polar', label: 'Polar' },
  paddle: { path: 'paddle', label: 'Paddle' },
  supabase: { path: 'supabase', label: 'Supabase' },
};

export function manualSyncTargets(mappings: Array<{ source: string; provider: string }>, role: string): ManualSyncTarget[] {
  const allowed = role === 'owner' || role === 'admin';
  if (!allowed && role !== 'member') return [];
  const unique = new Map<string, ManualSyncTarget>();
  for (const mapping of mappings) {
    const source = ['ga4', 'gsc'].includes(mapping.source) ? 'google' : mapping.source === 'business' ? mapping.provider : mapping.source;
    const target = targets[source];
    if (!target || (!allowed && !target.member)) continue;
    unique.set(target.path, { endpoint: '/api/sync/' + target.path, label: target.label });
  }
  return [...unique.values()];
}
