import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { processDueSyncSchedules } from '@/lib/sync-schedules';
import { executeAutomationRun, manualExecutionKey } from '@/lib/automation-runs';
import { refreshAgentActionOutcomes } from '@/lib/agent-action-outcomes';
import { refreshAgentGrowthMissions } from '@/lib/agent-growth-missions';

export async function POST(request: Request) { const secret = (env as unknown as { REPORT_CRON_SECRET?: string }).REPORT_CRON_SECRET; if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const run = async () => { await processDueSyncSchedules(); await refreshAgentActionOutcomes(); return refreshAgentGrowthMissions(); }; const result = await executeAutomationRun({ executionKey: manualExecutionKey('manual_sync'), kind: 'manual_sync', trigger: 'manual', tasks: [{ name: 'sync', run }] }); return NextResponse.json(result, { status: result.status === 'error' ? 500 : 200 }); }
