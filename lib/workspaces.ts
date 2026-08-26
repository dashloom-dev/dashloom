import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { workspaceMembers, workspacePreferences, workspaces } from '@/db/schema';

export async function getPrimaryWorkspace(userId: string) {
  const db = getDb();
  const [preference] = await db.select({ activeWorkspaceId: workspacePreferences.activeWorkspaceId }).from(workspacePreferences).where(eq(workspacePreferences.userId, userId)).limit(1);
  const [membership] = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      plan: workspaces.plan,
      locale: workspaces.locale,
      timezone: workspaces.timezone,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(preference ? and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, preference.activeWorkspaceId)) : eq(workspaceMembers.userId, userId))
    .limit(1);
  if (membership) return membership;
  const [fallback] = await db.select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, plan: workspaces.plan, locale: workspaces.locale, timezone: workspaces.timezone, role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(eq(workspaceMembers.userId, userId)).limit(1);
  if (fallback) await db.insert(workspacePreferences).values({ userId, activeWorkspaceId: fallback.id }).onConflictDoUpdate({ target: workspacePreferences.userId, set: { activeWorkspaceId: fallback.id, updatedAt: new Date().toISOString() } });
  return fallback ?? null;
}

export async function listUserWorkspaces(userId: string) {
  return getDb().select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, plan: workspaces.plan, role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(eq(workspaceMembers.userId, userId)).orderBy(workspaces.name);
}
