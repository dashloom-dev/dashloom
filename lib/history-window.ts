export const SYNC_HISTORY_DAYS = 60;

function dateAtOffset(offset: number, now: Date) {
  return new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
}

export function syncHistoryStart(now = new Date()) {
  return dateAtOffset(-SYNC_HISTORY_DAYS, now);
}

export function boundedHistoryRanges(maximumInclusiveDays: number, now = new Date()) {
  if (!Number.isInteger(maximumInclusiveDays) || maximumInclusiveDays < 1) throw new Error('History range size must be a positive integer.');
  const ranges: Array<{ start: string; end: string }> = [];
  for (let startOffset = -SYNC_HISTORY_DAYS; startOffset <= 0;) {
    const endOffset = Math.min(0, startOffset + maximumInclusiveDays - 1);
    ranges.push({ start: dateAtOffset(startOffset, now), end: dateAtOffset(endOffset, now) });
    startOffset = endOffset + 1;
  }
  return ranges;
}
