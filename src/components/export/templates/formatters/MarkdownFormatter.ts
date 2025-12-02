/**
 * Markdown Formatter Utilities
 *
 * Pure utility functions for generating markdown-formatted strings.
 * Following functional programming principles for testability.
 */

/**
 * Creates a markdown heading at the specified level
 */
export function heading(text: string, level: 1 | 2 | 3 | 4 | 5 | 6): string {
  const hashes = '#'.repeat(level);
  return `${hashes} ${text}\n\n`;
}

/**
 * Creates a markdown paragraph
 */
export function paragraph(text: string): string {
  return `${text}\n\n`;
}

/**
 * Creates a markdown blockquote
 */
export function blockquote(text: string): string {
  const lines = text.split('\n');
  return lines.map(line => `> ${line}`).join('\n') + '\n\n';
}

/**
 * Creates a markdown unordered list
 */
export function unorderedList(items: string[]): string {
  if (items.length === 0) return '';
  return items.map(item => `- ${item}`).join('\n') + '\n\n';
}

/**
 * Creates a markdown ordered list
 */
export function orderedList(items: string[]): string {
  if (items.length === 0) return '';
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n\n';
}

/**
 * Creates a markdown table
 */
export function table(headers: string[], rows: string[][]): string {
  if (headers.length === 0 || rows.length === 0) return '';

  const headerRow = `| ${headers.join(' | ')} |`;
  const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
  const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n');

  return `${headerRow}\n${separatorRow}\n${dataRows}\n\n`;
}

/**
 * Creates a markdown horizontal rule
 */
export function horizontalRule(): string {
  return '---\n\n';
}

/**
 * Creates bold text
 */
export function bold(text: string): string {
  return `**${text}**`;
}

/**
 * Creates italic text
 */
export function italic(text: string): string {
  return `*${text}*`;
}

/**
 * Creates inline code
 */
export function code(text: string): string {
  return `\`${text}\``;
}

/**
 * Creates a markdown link
 */
export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Creates a code block with optional language
 */
export function codeBlock(code: string, language?: string): string {
  const lang = language || '';
  return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
}

/**
 * Formats a date as a readable string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Formats a timestamp as date and time
 */
export function formatTimestamp(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Creates a markdown section with heading and content
 */
export function section(
  title: string,
  content: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 2
): string {
  return heading(title, level) + content;
}

/**
 * Creates a key-value pair formatted as markdown
 */
export function keyValue(key: string, value: string): string {
  return `- ${bold(key)}: ${value}`;
}

/**
 * Creates a metadata block
 */
export function metadataBlock(metadata: Record<string, string>): string {
  const entries = Object.entries(metadata)
    .map(([key, value]) => keyValue(key, value))
    .join('\n');
  return entries + '\n\n';
}

/**
 * Sanitizes text for markdown (escapes special characters)
 */
export function sanitize(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/\_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/\-/g, '\\-')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

/**
 * Truncates text to a maximum length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Creates a table of contents from headings
 */
export function tableOfContents(headings: Array<{ title: string; level: number }>): string {
  const toc = headings.map(({ title, level }) => {
    const indent = '  '.repeat(level - 1);
    const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    return `${indent}- [${title}](#${slug})`;
  }).join('\n');

  return toc + '\n\n';
}

/**
 * Wraps content in a collapsible section (GitHub-flavored markdown)
 */
export function collapsible(summary: string, content: string): string {
  return `<details>\n<summary>${summary}</summary>\n\n${content}\n</details>\n\n`;
}
