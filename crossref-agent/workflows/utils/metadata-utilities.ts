import * as fs from 'node:fs';
import * as v from 'valibot';
import type { FlueSession } from '@flue/runtime';
import { parseFrontmatter } from '../../lib/markdown-parser.js';
import { updateFrontmatter } from './yaml.js';

/**
 * Build the LLM prompt for metadata extraction.
 * Extracted to avoid duplication of prompt text across multiple call sites.
 */
export function buildMetadataExtractionPrompt(
  title: string,
  path: string,
  content: string
): string {
  return `Extract metadata from this documentation page.

Page title: ${title}
Page path: ${path}

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
}

/**
 * Extract metadata (description + keywords) from a documentation page.
 *
 * If metadata already present in frontmatter, returns cached version.
 * Otherwise, invokes LLM to extract and writes updated frontmatter to disk.
 *
 * Note: This function uses direct session.prompt() calls to prevent
 * reentrant session calls that would cause deadlock (Issue #3).
 * It is NOT available as an agent tool - it's called directly by the workflow.
 */
export async function extractMetadata(
  entry: { id: string; title: string; path: string; absPath: string },
  content: string,
  session: FlueSession
): Promise<{
  metadata: { description: string; keywords: string[] };
  updatedContent: string;
}> {
  const fm = parseFrontmatter(content);
  const hasMetadata =
    fm.description !== null &&
    fm.description !== undefined &&
    typeof fm.description === 'string' &&
    Array.isArray(fm.keywords) &&
    fm.keywords.length > 0;

  if (hasMetadata) {
    return {
      metadata: { description: fm.description, keywords: fm.keywords },
      updatedContent: content,
    };
  }

  console.log(`[crossref] Extracting metadata for ${entry.id}...`);

  const prompt = buildMetadataExtractionPrompt(entry.title, entry.path, content);

  const metadataResult = await session.prompt(prompt, {
    result: v.object({
      description: v.string(),
      keywords: v.array(v.string()),
    }),
  });

  const metadata = metadataResult.data;
  const updatedContent = updateFrontmatter(content, metadata);

  fs.writeFileSync(entry.absPath, updatedContent, 'utf-8');

  console.log(`[crossref] Metadata extracted and written for ${entry.id}`);

  return { metadata, updatedContent };
}
