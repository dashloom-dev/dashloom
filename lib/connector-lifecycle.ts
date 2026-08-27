export type ConnectorLifecycleAccount = {
  id: string;
  provider: string;
  displayName: string;
  status: 'pending' | 'connected' | 'attention' | 'disabled';
  lastCheckedAt: string | null;
};

export type ConnectorLifecycleMapping = { connectorAccountId: string; enabled: boolean };
export type ConnectorLifecycleRun = { connectorAccountId: string | null; status: 'queued' | 'running' | 'success' | 'partial' | 'error'; errorCode: string | null; createdAt: string };

const providerNames: Record<string, string> = {
  cloudflare: 'Cloudflare', cloudflare_pages: 'Cloudflare Pages', cloudflare_queues: 'Cloudflare Queues', google: 'Google', bing: 'Bing Webmaster', d1: 'Cloudflare D1', stripe: 'Stripe', lemonsqueezy: 'Lemon Squeezy', creem: 'Creem', polar: 'Polar', paddle: 'Paddle Billing', supabase: 'Supabase', github: 'GitHub', vercel: 'Vercel', custom: 'Custom REST',
};

export function connectorProviderName(provider: string) {
  return providerNames[provider] || provider.replaceAll('_', ' ');
}

export function buildConnectorAccountViews(accounts: ConnectorLifecycleAccount[], mappings: ConnectorLifecycleMapping[], runs: ConnectorLifecycleRun[] = []) {
  return accounts.map((account) => {
    const providerName = connectorProviderName(account.provider);
    const mappingCount = mappings.filter((mapping) => mapping.connectorAccountId === account.id && mapping.enabled).length;
    const lastRun = runs.find((run) => run.connectorAccountId === account.id) || null;
    const needsAttention = account.status === 'attention' || lastRun?.status === 'error' || (account.status === 'connected' && mappingCount === 0);
    const diagnosis = account.status === 'disabled'
      ? 'The local credential has been removed. Reconnect with a new provider credential to collect data again.'
      : account.status === 'pending'
        ? 'Credential validation did not finish. Re-enter the credential and complete the provider check.'
        : mappingCount === 0
          ? `The ${providerName} credential is available, but no active product mapping remains.`
          : lastRun?.status === 'error'
            ? `The latest synchronization failed${lastRun.errorCode ? ` (${lastRun.errorCode})` : ''}. The credential, provider permissions, or selected resource may have changed.`
            : account.status === 'attention'
              ? 'The last provider check failed. Verify the credential, required read permissions, and selected resource.'
              : `The credential and ${mappingCount} active mapping${mappingCount === 1 ? '' : 's'} are ready.`;
    return {
      id: account.id,
      provider: account.provider,
      providerName,
      displayName: account.displayName,
      status: account.status,
      health: account.status === 'disabled' ? 'disconnected' as const : needsAttention ? 'needs_attention' as const : account.status === 'pending' ? 'setup' as const : 'healthy' as const,
      diagnosis,
      repairChecks: connectorRepairChecks(account.provider, mappingCount),
      repairHref: `#connector-${account.provider}`,
      lastCheckedAt: account.lastCheckedAt,
      mappingCount,
      lastRunStatus: lastRun?.status || null,
      lastRunAt: lastRun?.createdAt || null,
      lastErrorCode: lastRun?.errorCode || null,
    };
  });
}

function connectorRepairChecks(provider: string, mappingCount: number) {
  const credential = provider === 'google' ? 'Reconnect Google OAuth and approve the requested Analytics or Search Console read scopes.' : provider === 'bing' ? 'Regenerate or re-enter the user-level Bing Webmaster API key and confirm the site remains verified.' : provider.startsWith('cloudflare') || provider === 'd1' ? 'Confirm the Cloudflare token can read the selected account and resource.' : ['stripe', 'lemonsqueezy', 'creem', 'polar', 'paddle'].includes(provider) ? 'Rotate or re-enter a restricted read credential for the selected merchant account.' : 'Re-enter the provider credential and verify its read permissions.';
  return [credential, mappingCount ? 'Confirm the mapped resource still exists and remains visible to that credential.' : 'Create an active mapping from this account to a product.', 'Run a manual synchronization and confirm that new evidence is written.'];
}
