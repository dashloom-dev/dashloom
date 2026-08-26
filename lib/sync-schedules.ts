import { and, asc, eq, lte } from 'drizzle-orm';
import { getDb } from '@/db';
import { syncSchedules } from '@/db/schema';
import { syncCloudflareWorkspace } from '@/lib/cloudflare';
import { syncD1Workspace } from '@/lib/d1-connector';
import { syncGoogleWorkspace } from '@/lib/google';
import { syncStripeWorkspace } from '@/lib/stripe-connector';
import { syncLemonSqueezyWorkspace } from '@/lib/lemon-squeezy-connector';
import { syncGitHubWorkspace } from '@/lib/github-connector';
import { syncVercelWorkspace } from '@/lib/vercel-connector';
import { syncCreemWorkspace } from '@/lib/creem-connector';
import { syncSupabaseWorkspace } from '@/lib/supabase-connector';
import { syncPolarWorkspace } from '@/lib/polar-connector';
import { syncPaddleWorkspace } from '@/lib/paddle-connector';
import { syncCloudflareR2Workspace } from '@/lib/cloudflare-r2';
import { syncCloudflarePagesWorkspace } from '@/lib/cloudflare-pages';
import { syncCloudflareQueuesWorkspace } from '@/lib/cloudflare-queues';
import { syncCustomRestWorkspace } from '@/lib/custom-rest-connector';
import { nextSyncTime, retrySyncTime } from '@/lib/sync-time';
import { refreshCalculatedMetricsSafely } from '@/lib/calculated-metrics';

const runners = { cloudflare: syncCloudflareWorkspace, cloudflare_r2: syncCloudflareR2Workspace, cloudflare_pages: syncCloudflarePagesWorkspace, cloudflare_queues: syncCloudflareQueuesWorkspace, google: syncGoogleWorkspace, d1: syncD1Workspace, stripe: syncStripeWorkspace, lemonsqueezy: syncLemonSqueezyWorkspace, creem: syncCreemWorkspace, polar: syncPolarWorkspace, paddle: syncPaddleWorkspace, supabase: syncSupabaseWorkspace, github: syncGitHubWorkspace, vercel: syncVercelWorkspace, custom: syncCustomRestWorkspace } as const;
export async function processDueSyncSchedules(limit = 20) {
  const db = getDb(); const now = new Date(); const due = await db.select().from(syncSchedules).where(and(eq(syncSchedules.enabled, true), lte(syncSchedules.nextRunAt, now.toISOString()))).orderBy(asc(syncSchedules.nextRunAt)).limit(limit); const results = [];
  for (const schedule of due) { const claimedNext = nextSyncTime(schedule.frequencyMinutes, now); const claimed = await db.update(syncSchedules).set({ nextRunAt: claimedNext, lastRunAt: now.toISOString(), updatedAt: now.toISOString() }).where(and(eq(syncSchedules.id, schedule.id), eq(syncSchedules.nextRunAt, schedule.nextRunAt))).returning({ id: syncSchedules.id }); if (!claimed.length) continue; try { const outcome = await runners[schedule.source](schedule.workspaceId); const calculated = await refreshCalculatedMetricsSafely(schedule.workspaceId); await db.update(syncSchedules).set({ lastSuccessAt: new Date().toISOString(), retryAttempt: 0, lastError: null, updatedAt: new Date().toISOString() }).where(eq(syncSchedules.id, schedule.id)); results.push({ scheduleId: schedule.id, source: schedule.source, status: 'success', outcome, calculated }); } catch (error) { const attempt = schedule.retryAttempt + 1; const message = error instanceof Error ? error.message.slice(0, 500) : 'Scheduled sync failed'; await db.update(syncSchedules).set({ nextRunAt: retrySyncTime(attempt, now), retryAttempt: attempt, lastError: message, updatedAt: new Date().toISOString() }).where(eq(syncSchedules.id, schedule.id)); results.push({ scheduleId: schedule.id, source: schedule.source, status: 'error', retryAttempt: attempt, error: message }); } }
  return { processed: results.length, results };
}
