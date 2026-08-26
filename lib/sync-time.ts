export function nextSyncTime(frequencyMinutes: number, from = new Date()) { return new Date(from.getTime() + frequencyMinutes * 60_000).toISOString(); }
export function retrySyncTime(attempt: number, from = new Date()) { return new Date(from.getTime() + Math.min(360, 15 * 2 ** Math.min(attempt, 5)) * 60_000).toISOString(); }
