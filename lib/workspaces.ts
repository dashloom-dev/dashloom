import { eq, sql } from 'drizzle-orm';
import { cache } from 'react';
import { getDb } from '@/db';
import { workspaceMembers, workspacePreferences, workspaces } from '@/db/schema';

export const getPrimaryWorkspace = cache(async (userId: string) => {
  const db = getDb();
  const [membership] = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      plan: workspaces.plan,
      locale: workspaces.locale,
      timezone: workspaces.timezone,
      role: workspaceMembers.role,
      activeWorkspaceId: workspacePreferences.activeWorkspaceId,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .leftJoin(workspacePreferences, eq(workspacePreferences.userId, userId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(sql`case when ${workspaceMembers.workspaceId} = ${workspacePreferences.activeWorkspaceId} then 0 else 1 end`, workspaces.name)
    .limit(1);
  if (!membership) return null;
  const { activeWorkspaceId, ...workspace } = membership;
  if (activeWorkspaceId !== workspace.id) await db.insert(workspacePreferences).values({ userId, activeWorkspaceId: workspace.id }).onConflictDoUpdate({ target: workspacePreferences.userId, set: { activeWorkspaceId: workspace.id, updatedAt: new Date().toISOString() } });
  return workspace;
});

export async function listUserWorkspaces(userId: string) {
  return getDb().select({ id: workspaces.id, slug: workspaces.slug, name: workspaces.name, plan: workspaces.plan, role: workspaceMembers.role }).from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id)).where(eq(workspaceMembers.userId, userId)).orderBy(workspaces.name);
}
