import { defineTool, Type } from '@flue/runtime';
import * as fs from 'node:fs';
import * as v from 'valibot';
import { parseFrontmatter, extractHeadings } from './markdown-parser.js';
import type { CrossrefState } from './schemas.js';

export function createMetadataExtractorTool(
  state: CrossrefState,
  docsDir: string,
  session: any
) {
  return defineTool({
    name: 'extract_page_metadata',
    description: 'Extract description and keywords from a documentation page. If metadata exists in the page frontmatter, returns it immediately. If missing, uses LLM to extract both fields in a single call, then writes them back to the page frontmatter permanently.',
    parameters: Type.Object({
      pageId: Type.String({
        description: 'The page ID (e.g., "reference__stream__zsink__index") to extract metadata for'
      }),
    }),
    execute: async (args: Record<string, any>) => {
      const pageId = args.pageId as string;
      const entry = state.index.find(e => e.id === pageId);
      if (!entry) {
        return JSON.stringify({
          error: `Page ${pageId} not found in index`
        });
      }

      // If already in state, return immediately
      // Note: Check for undefined/null, not falsy - empty string is valid
      // Issue #3 fix: Check that keywords is not null (empty arrays are valid, falsy check rejects them)
      if (entry.description !== undefined && entry.description !== null && entry.keywords !== undefined && entry.keywords !== null) {
        return JSON.stringify({
          description: entry.description,
          keywords: entry.keywords,
          source: 'state_cache'
        });
      }

      // Missing fields - use ONE LLM call to extract both
      const content = fs.readFileSync(entry.absPath, 'utf-8');

      const prompt = `Extract metadata from this documentation page.

Page title: ${entry.title}
Page path: ${entry.path}

Content:
${content}

Return ONLY valid JSON:
{
  "description": "one-sentence, concisely at most 150-160 characters",
  "keywords": ["3-7 meaningful keyword phrases (1-3 words each, not single fragments)"]
}

Keyword guidelines:
- Use compound phrases: "Console Service" not "Console"
- Use domain terminology: "Environment Variable" not "environment"
- Make keywords meaningful on their own: "System Properties" not "properties"
- Avoid generic single words: use "built-in services" not "services" or "built-in"
- Focus on what users would search for`;

      const result = await session.prompt(prompt, {
        result: v.object({
          description: v.string(),
          keywords: v.array(v.string()),
        })
      });

      const metadata = result.data;

      // Write back to page frontmatter permanently
      const updated = updateFrontmatter(content, metadata);
      fs.writeFileSync(entry.absPath, updated, 'utf-8');

      // Update state cache
      entry.description = metadata.description;
      entry.keywords = metadata.keywords;

      return JSON.stringify({
        ...metadata,
        source: 'extracted_and_written'
      });
    }
  });
}

// Quote a string value for YAML (used for array items and string literals)
// Issue #3 fix: Only quote if necessary to avoid conflicting with serializeYamlValue logic
// Issue #5 fix: Ensure spaces are always quoted for YAML safety
function quoteYamlString(value: string): string {
  if (!value) return '""';
  // Check for characters that require quoting
  if (value.includes('\n') || value.includes('"') || value.includes(':') || value.includes('[') || value.includes(']') || value.includes('#') || /\s/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  // Return unquoted for simple alphanumeric values only
  return value;
}

// Serialize any value for YAML, preserving types (Issue #6 fix: don't over-quote)
function serializeYamlValue(value: any): string {
  // Numbers: no quotes (preserve numeric type)
  if (typeof value === 'number') {
    return String(value);
  }

  // Booleans: no quotes (preserve boolean type)
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  // Null/undefined: special case
  if (value === null || value === undefined) {
    return 'null';
  }

  // Strings: quote only if needed
  if (typeof value === 'string') {
    // Plain alphanumeric values don't need quotes
    if (/^[a-zA-Z0-9._/-]+$/.test(value)) {
      return value;
    }

    // Quote if contains YAML special characters
    if (/[\n"':[\]{}@`#]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }

    // Default: quote to be safe
    return `"${value}"`;
  }

  // Fallback: convert to string and quote
  return `"${String(value)}"`;
}

function updateFrontmatter(content: string, metadata: { description: string; keywords: string[] }): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);

  if (!fmMatch) {
    const keywordsList = metadata.keywords
      .map(k => `  - ${quoteYamlString(k)}`)
      .join('\n');
    const newFm = `description: ${quoteYamlString(metadata.description)}\nkeywords:\n${keywordsList}`;
    return `---\n${newFm}\n---\n${content}`;
  }

  const fm: Record<string, any> = parseFrontmatter(content);
  fm.description = metadata.description;
  fm.keywords = metadata.keywords;

  const newFm = Object.entries(fm)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        const items = v.map((x: any) => `  - ${quoteYamlString(String(x))}`).join('\n');
        return `${k}:\n${items}`;
      }
      // Use type-aware serialization to preserve number/boolean types (Issue #6 fix)
      return `${k}: ${serializeYamlValue(v)}`;
    })
    .join('\n');

  return `---\n${newFm}\n---\n${content.slice(fmMatch[0].length)}`;
}

export function createValidateAnchorTool(state: CrossrefState) {
  return defineTool({
    name: 'validate_anchor',
    description: 'Check if an anchor/heading exists in a target page. Returns whether the anchor is available and lists all available headings.',
    parameters: Type.Object({
      pageId: Type.String({
        description: 'The page ID to check (e.g., "reference__core__runtime")'
      }),
      anchorText: Type.String({
        description: 'The anchor text or heading to validate (e.g., "setConfigProvider", "set_config_provider")'
      }),
    }),
    execute: async (args: Record<string, any>) => {
      const pageId = args.pageId as string;
      const anchorText = args.anchorText as string;

      const entry = state.index.find(e => e.id === pageId);
      if (!entry) {
        return JSON.stringify({
          error: `Page ${pageId} not found in index`,
        });
      }

      try {
        const content = fs.readFileSync(entry.absPath, 'utf-8');
        const headings = extractHeadings(content);

        // Normalize anchor for matching
        const normalizedAnchor = anchorText.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');

        // Check if anchor exists (exact or partial match)
        const found = headings.some(h =>
          h.slug === normalizedAnchor ||
          h.slug.includes(normalizedAnchor) ||
          normalizedAnchor.includes(h.slug)
        );

        return JSON.stringify({
          pageId,
          anchorText,
          exists: found,
          availableHeadings: headings.map(h => ({
            text: h.text,
            slug: h.slug,
          })),
        });
      } catch (e) {
        return JSON.stringify({
          error: `Failed to read page: ${e}`,
        });
      }
    }
  });
}

export function createExtractPageStructureTool(state: CrossrefState) {
  return defineTool({
    name: 'extract_page_structure',
    description: 'Extract the heading structure (table of contents) from a page. Shows all available anchors that can be linked to.',
    parameters: Type.Object({
      pageId: Type.String({
        description: 'The page ID (e.g., "reference__stream__zsink__index")'
      }),
    }),
    execute: async (args: Record<string, any>) => {
      const pageId = args.pageId as string;

      const entry = state.index.find(e => e.id === pageId);
      if (!entry) {
        return JSON.stringify({
          error: `Page ${pageId} not found in index`,
        });
      }

      try {
        const content = fs.readFileSync(entry.absPath, 'utf-8');
        const headings = extractHeadings(content);

        return JSON.stringify({
          pageId,
          title: entry.title,
          headings: headings.map(h => ({
            text: h.text,
            slug: h.slug,
          })),
        });
      } catch (e) {
        return JSON.stringify({
          error: `Failed to read page: ${e}`,
        });
      }
    }
  });
}

export function createGetAdjacentPagesTool(state: CrossrefState) {
  return defineTool({
    name: 'get_adjacent_pages',
    description: 'Get all pages in the same documentation section. Adjacent pages are strong candidates for See Also links.',
    parameters: Type.Object({
      pageId: Type.String({
        description: 'The page ID (e.g., "reference__stream__zsink__index")'
      }),
    }),
    execute: async (args: Record<string, any>) => {
      const pageId = args.pageId as string;

      const entry = state.index.find(e => e.id === pageId);
      if (!entry) {
        return JSON.stringify({
          error: `Page ${pageId} not found in index`,
        });
      }

      const adjacentPages = entry.adjacentPages || [];
      const adjacentEntries = adjacentPages
        .map(id => state.index.find(e => e.id === id))
        .filter((e): e is typeof state.index[0] => !!e)
        .map(e => ({
          id: e.id,
          title: e.title,
          path: e.path,
          description: e.description || null,
        }));

      return JSON.stringify({
        pageId,
        title: entry.title,
        adjacentCount: adjacentEntries.length,
        adjacent: adjacentEntries,
      });
    }
  });
}
