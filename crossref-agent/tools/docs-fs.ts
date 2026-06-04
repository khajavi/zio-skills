import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { defineTool } from '@flue/runtime';
import * as v from 'valibot';

export const readDoc = defineTool({
  name: 'read_doc',
  description: 'Read a documentation file from the real filesystem',
  parameters: v.object({ docsDir: v.string(), absPath: v.string() }),
  execute: async ({ docsDir, absPath }) => {
    // Path-traversal protection
    const normalizedDocsDir = path.resolve(docsDir);
    let realPath: string;
    try {
      realPath = fsSync.realpathSync(absPath);
    } catch {
      throw new Error(`Path not readable: ${absPath}`);
    }
    if (!realPath.startsWith(normalizedDocsDir + path.sep) &&
        realPath !== normalizedDocsDir) {
      throw new Error(`Path outside docs directory: ${absPath}`);
    }
    return fs.readFile(absPath, 'utf-8');
  },
});

export const writeDoc = defineTool({
  name: 'write_doc',
  description: 'Write content back to a documentation file',
  parameters: v.object({ docsDir: v.string(), absPath: v.string(), content: v.string() }),
  execute: async ({ docsDir, absPath, content }) => {
    // Path-traversal protection
    const normalizedDocsDir = path.resolve(docsDir);
    let realPath: string;
    try {
      realPath = fsSync.realpathSync(path.dirname(absPath));
    } catch {
      throw new Error(`Directory not accessible: ${path.dirname(absPath)}`);
    }
    if (!realPath.startsWith(normalizedDocsDir + path.sep) &&
        realPath !== normalizedDocsDir) {
      throw new Error(`Path outside docs directory: ${absPath}`);
    }
    await fs.writeFile(absPath, content, 'utf-8');
    return 'ok';
  },
});
