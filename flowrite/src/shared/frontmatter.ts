/**
 * Build a Docusaurus/MDX YAML frontmatter block for a documentation page.
 * `keywords` is emitted as a YAML block list (one `- item` per line), not an
 * inline flow array — Docusaurus expects the block form for its keyword tags.
 */
export function buildFrontmatter(fields: {
  id: string;
  title: string;
  description: string;
  keywords: string[];
}): string {
  const keywords = fields.keywords.length
    ? `keywords:\n${fields.keywords.map((k) => `  - ${JSON.stringify(k)}`).join('\n')}`
    : 'keywords: []';
  return [
    '---',
    `id: ${fields.id}`,
    `title: ${JSON.stringify(fields.title)}`,
    `description: ${JSON.stringify(fields.description)}`,
    keywords,
    '---',
  ].join('\n');
}

/**
 * Join a frontmatter block to a page body with exactly one blank line between
 * them. A body glued directly to the closing `---` renders wrong; strip any
 * leading newlines the model added so the separation is always one blank line.
 */
export function withFrontmatter(frontmatter: string, body: string): string {
  return `${frontmatter}\n\n${body.replace(/^\n+/, '')}`;
}
