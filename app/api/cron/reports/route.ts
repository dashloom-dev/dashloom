import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { processDueReportSchedules } from '@/lib/schedules';
import { executeAutomationRun, manualExecutionKey } from '@/lib/automation-runs';

export async function POST(request: Request) {
  const secret = (env as unknown as { REPORT_CRON_SECRET?: string }).REPORT_CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await executeAutomationRun({ executionKey: manualExecutionKey('manual_reports'), kind: 'manual_reports', trigger: 'manual', tasks: [{ name: 'reports', run: processDueReportSchedules }] });
  return NextResponse.json(result, { status: result.status === 'error' ? 500 : 200 });
}
