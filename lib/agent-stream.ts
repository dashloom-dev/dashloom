// Project only user-facing JSON string fields, including the current partial field.
// Never render raw JSON, identifiers, or provider reasoning channels.
export function readableAgentStream(source: string): string {
  const visible = new Set(['summary', 'overview', 'title', 'detail', 'description', 'action', 'recommendation']);
  const paragraphs: string[] = [];
  let key = '';
  for (let index = 0; index < source.length; index++) {
    if (source[index] !== '"') continue;
    const start = ++index;
    while (index < source.length) {
      if (source[index] === '\\') { index += 2; continue; }
      if (source[index] === '"') break;
      index++;
    }
    const complete = index < source.length;
    let raw = source.slice(start, index);
    if (!complete) raw = raw.replace(/\\(?:u[0-9a-fA-F]{0,3})?$/, '');
    let value = '';
    try { value = JSON.parse('"' + raw + '"') as string; } catch { continue; }
    const rest = source.slice(index + 1).trimStart();
    if (complete && rest.startsWith(':')) { key = value; continue; }
    if (visible.has(key) && value) paragraphs.push(value);
    key = '';
  }
  return paragraphs.join('\n\n');
}
