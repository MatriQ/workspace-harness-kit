/** Bounded Markdown inspection, not rendering: fenced examples are excluded from prose links/headings. */
export function proseLines(body: string): string[] {
  let fence: { character: string; length: number } | undefined;
  const lines = body.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' ')).split('\n');
  const frontmatterEnd = lines[0]?.trim() === '---' ? lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) : -1;
  return lines.map((line, index) => {
    if (frontmatterEnd >= 0 && index <= frontmatterEnd) return '';
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (marker && !fence) { fence = { character: marker[1][0], length: marker[1].length }; return ''; }
    if (fence) { if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined; return ''; }
    return line;
  });
}
function plain(value: string): string { return value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '').replace(/[*_`]/g, '').replace(/\\([\p{P}])/gu, '$1').trim(); }
export interface MarkdownHeading { text: string; anchor: string; level: number; line: number }
export function markdownHeadings(body: string): MarkdownHeading[] {
  const lines = proseLines(body), headings: MarkdownHeading[] = [], anchors = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const atx = /^ {0,3}(#{1,6})(?:\s+(.+?)\s*#*\s*|\s*)$/.exec(line);
    const setext = !atx && line.trim() && index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[index + 1]);
    if (!atx && !setext) continue;
    const heading = plain(atx ? atx[2] ?? '' : line);
    const base = heading.toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/\s/g, '-');
    let anchor = base, suffix = 0; while (anchors.has(anchor)) anchor = `${base}-${++suffix}`; anchors.add(anchor);
    headings.push({ text: heading, anchor, level: atx ? atx[1].length : lines[index + 1].trim().startsWith('=') ? 1 : 2, line: index });
  }
  return headings;
}
export function markdownSection(body: string, heading?: string): string | undefined {
  const lines = body.split('\n'), headings = markdownHeadings(body);
  const selected = heading === undefined ? undefined : headings.filter(item => item.text === heading);
  if (selected && selected.length !== 1) return undefined;
  const start = selected?.[0], end = start ? headings.find(item => item.line > start.line && item.level <= start.level)?.line : undefined;
  const headingLines = new Set(headings.flatMap(item => /^ {0,3}#{1,6}(?:\s|$)/.test(lines[item.line]) ? [item.line] : [item.line, item.line + 1]));
  const frontmatterEnd = lines[0]?.trim() === '---' ? lines.findIndex((line, index) => index > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) : -1;
  const section = lines.map((line, index) => headingLines.has(index) || index <= frontmatterEnd ? '' : line).slice(start ? start.line + 1 : 0, end).join('\n');
  return section.replace(/<!--[\s\S]*?-->/g, '').replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gm, '').trim();
}
export function markdownLinks(body: string): { links: Array<{ destination: string; line: number }>; unresolved: string[] } {
  const lines = proseLines(body), definitions = new Map<string, string>(), links: Array<{ destination: string; line: number }> = [], unresolved: string[] = [];
  const key = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  for (const line of lines) {
    const match = /^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/.exec(line);
    if (match) definitions.set(key(match[1]), match[2] ?? match[3]);
  }
  for (const [index, raw] of lines.entries()) {
    if (/^ {0,3}\[[^\]]+\]:/.test(raw)) continue;
    const line = raw.replace(/`+[^`]*`+/g, '');
    const inline = /!?\[[^\]\n]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g;
    for (const match of line.matchAll(inline)) links.push({ destination: match[1] ?? match[2], line: index + 1 });
    const remaining = line.replace(inline, '');
    const references = /!?\[([^\]\n]+)\]\[([^\]\n]*)\]/g;
    for (const match of remaining.matchAll(references)) {
      const label = match[2] || match[1], destination = definitions.get(key(label));
      if (destination) links.push({ destination, line: index + 1 }); else unresolved.push(label);
    }
    for (const match of remaining.replace(references, '').matchAll(/!?\[([^\]\n]+)\]/g)) {
      const destination = definitions.get(key(match[1])); if (destination) links.push({ destination, line: index + 1 });
    }
  }
  return { links, unresolved };
}
export function markdownHasAnchor(body: string, anchor: string): boolean {
  return markdownHeadings(body).some(heading => heading.anchor === anchor)
    || [...proseLines(body).join('\n').matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)=["']([^"']+)["'][^>]*>/gi)].some(match => match[1] === anchor);
}
