export async function getWorkspaceEntitlements(workspaceId: string) {
  if (!workspaceId) throw new Error('Workspace not found.');
  return {
    plan: 'community' as const,
    managedRunsPerDay: 0,
    managedRunsUsedToday: 0,
    managedRunsRemainingToday: 0,
    products: 10000,
    members: 1,
    scheduledReports: 1000,
    minimumSyncMinutes: 15,
    maximumRetentionDays: 3650,
  };
}
