import type { AgentPreset } from './agent-catalog.ts';
import { executivePresetOrder } from './executive-brief.ts';

type Digest = {
  specialists: Array<{ agent: string; analysisRunId: string; summary: string; findingCount: number }>;
  priorities: Array<{ title: string; detail: string; agent: string; action: string; confidence: number; evidenceRefs: string[]; analysisRunId: string }>;
};

export function parseExecutiveSchedulePresets(raw: string): AgentPreset[] {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('Saved Executive Brief specialists are invalid.'); }
  if (!Array.isArray(value)) throw new Error('Saved Executive Brief specialists are invalid.');
  const unique = [...new Set(value)];
  if (unique.length < 2 || unique.length > 5 || unique.some((preset) => typeof preset !== 'string' || !executivePresetOrder.includes(preset as AgentPreset))) throw new Error('Saved Executive Brief specialists are invalid.');
  return (unique as AgentPreset[]).sort((left, right) => executivePresetOrder.indexOf(left) - executivePresetOrder.indexOf(right));
}

export function formatExecutiveReportSections(digest: Digest) {
  const specialists = digest.specialists.map((specialist) => `- **${specialist.agent}:** ${specialist.summary} (${specialist.findingCount} findings)`).join('\n');
  const priorities = digest.priorities.map((priority, index) => `## ${index + 1}. ${priority.title}\n\n${priority.detail}\n\n**Specialist:** ${priority.agent}\n\n**Next action:** ${priority.action}\n\n**Confidence:** ${Math.round(priority.confidence * 100)}%`).join('\n\n');
  return { specialists, priorities };
}
