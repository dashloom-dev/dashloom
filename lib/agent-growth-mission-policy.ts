export type GrowthMissionAssessment = 'awaiting' | 'on_track' | 'off_track' | 'achieved' | 'missed' | 'insufficient';

export const GROWTH_MISSION_LIMITATION = 'Mission progress compares later product evidence with a frozen baseline and target. It does not prove that the action caused the observed change.';

export function growthMissionProgressPercent(baseline: number, target: number, latest: number) {
  if (![baseline, target, latest].every(Number.isFinite) || target === baseline) return null;
  return ((latest - baseline) / (target - baseline)) * 100;
}

export function assessGrowthMission(input: { baseline: number; target: number; latest: number | null; dueAt: string; now: Date }) {
  const expired = input.now.getTime() >= new Date(input.dueAt).getTime();
  if (input.latest === null) return { assessment: expired ? 'insufficient' : 'awaiting' as GrowthMissionAssessment, terminal: expired };
  const progress = growthMissionProgressPercent(input.baseline, input.target, input.latest);
  if (progress === null) return { assessment: 'insufficient' as GrowthMissionAssessment, terminal: expired };
  if (progress >= 100) return { assessment: 'achieved' as GrowthMissionAssessment, terminal: true };
  if (expired) return { assessment: 'missed' as GrowthMissionAssessment, terminal: true };
  return { assessment: progress > 0 ? 'on_track' : 'off_track' as GrowthMissionAssessment, terminal: false };
}
