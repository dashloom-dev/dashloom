type Cadence = 'daily' | 'weekly' | 'monthly';
type Parts = { year: number; month: number; day: number; hour: number; weekday: number };

function localParts(date: Date, timezone: string): Parts {
  const format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
  const values = Object.fromEntries(format.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), weekday: weekdays[values.weekday] };
}

function zonedTime(year: number, month: number, day: number, hour: number, timezone: string) {
  let timestamp = Date.UTC(year, month - 1, day, hour);
  for (let attempt = 0; attempt < 2; attempt += 1) { const actual = localParts(new Date(timestamp), timezone); timestamp += Date.UTC(year, month - 1, day, hour) - Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour); }
  return new Date(timestamp);
}

export function nextScheduleRun(input: { cadence: Cadence; timezone: string; hourLocal: number; dayOfWeek?: number | null; dayOfMonth?: number | null }, after = new Date()) {
  const local = localParts(after, input.timezone);
  for (let offset = 0; offset <= 40; offset += 1) { const calendar = new Date(Date.UTC(local.year, local.month - 1, local.day + offset)); const year = calendar.getUTCFullYear(); const month = calendar.getUTCMonth() + 1; const day = calendar.getUTCDate(); const weekday = calendar.getUTCDay(); const matches = input.cadence === 'daily' || (input.cadence === 'weekly' && weekday === (input.dayOfWeek ?? 1)) || (input.cadence === 'monthly' && day === Math.min(input.dayOfMonth ?? 1, new Date(Date.UTC(year, month, 0)).getUTCDate())); if (!matches) continue; const candidate = zonedTime(year, month, day, input.hourLocal, input.timezone); if (candidate.getTime() > after.getTime() + 1000) return candidate.toISOString(); }
  throw new Error('Could not calculate the next report run.');
}
