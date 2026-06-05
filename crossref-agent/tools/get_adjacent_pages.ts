import { defineTool, Type } from '@flue/runtime';
import type { CrossrefState } from './schemas.js';

export function createGetAdjacentPages(state: CrossrefState) {
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
