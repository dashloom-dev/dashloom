import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db';
import { analysisRuns, dashboardViews, products } from '@/db/schema';
import { agentResultSchema } from './agent';
import { agentDefinitions, type AgentPreset } from './agent-catalog';
import { buildAgentDashboardDefinition } from './agent-dashboard-policy';

export async function createDashboardFromAnalysis(workspaceId: string, analysisRunId: string) {
  const db = getDb();
  const [existing] = await db.select().from(dashboardViews).where(and(eq(dashboardViews.workspaceId, workspaceId), eq(dashboardViews.sourceAnalysisRunId, analysisRunId))).limit(1);
  if (existing) return { view: existing, created: false };
  const [run] = await db.select().from(analysisRuns).where(and(eq(analysisRuns.id, analysisRunId), eq(analysisRuns.workspaceId, workspaceId), eq(analysisRuns.status, 'success'))).limit(1);
  if (!run?.findingsJson) throw new Error('A successful Agent analysis is required.');
  const result = agentResultSchema.parse(JSON.parse(run.findingsJson));
  const definition = buildAgentDashboardDefinition(runPreset(run.evidenceJson), result, run.createdAt);
  let productId = definition.productId;
  if (productId) {
    const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.workspaceId, workspaceId))).limit(1);
    if (!product) productId = null;
  }
  const id = crypto.randomUUID();
  const inserted = await db.insert(dashboardViews).values({ id, workspaceId, sourceAnalysisRunId: run.id, origin: 'agent', productId, preset: definition.preset, name: definition.name, configurationJson: JSON.stringify(definition.configuration), isDefault: false }).onConflictDoNothing({ target: dashboardViews.sourceAnalysisRunId }).returning();
  if (inserted[0]) return { view: inserted[0], created: true };
  const [replayed] = await db.select().from(dashboardViews).where(and(eq(dashboardViews.workspaceId, workspaceId), eq(dashboardViews.sourceAnalysisRunId, analysisRunId))).limit(1);
  if (!replayed) throw new Error('Dashboard could not be created.');
  return { view: replayed, created: false };
}

function runPreset(evidenceJson: string): AgentPreset {
  try {
    const preset = (JSON.parse(evidenceJson) as { agentPreset?: unknown }).agentPreset;
    if (typeof preset === 'string' && Object.hasOwn(agentDefinitions, preset)) return preset as AgentPreset;
  } catch { /* fall through to the broadest safe view */ }
  return 'portfolio_analyst';
}
