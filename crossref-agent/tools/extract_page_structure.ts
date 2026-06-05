import { defineTool, Type } from '@flue/runtime';
import * as fs from 'node:fs';
import { extractHeadings } from './markdown-parser.js';
import type { CrossrefState } from './schemas.js';

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
