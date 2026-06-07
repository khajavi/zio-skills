import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FlueContext } from '@flue/runtime';
import { Anthropic } from '@anthropic-ai/sdk';
import type { BuildError } from '../lib/build-error-extractor.js';

export interface DocFixerPayload {
  docsDir: string;
  buildErrors: BuildError[];
  buildOutput: string;
  buildSystem: 'docusaurus' | 'mkdocs' | 'sphinx' | 'hugo';
  attempt: number;
}

export interface FixResult {
  fixed: boolean;
  fixedCount: number;
  summary: string;
  changes: Array<{
    file: string;
    change: string;
  }>;
}

export async function runDocFixer(payload: DocFixerPayload): Promise<FixResult> {
  const { docsDir, buildErrors, buildOutput, buildSystem, attempt } = payload;

  const client = new Anthropic();
  const changes: Array<{ file: string; change: string }> = [];

  console.log(`[doc-fixer] Analyzing ${buildErrors.length} build errors (attempt ${attempt})`);

  for (const error of buildErrors) {
    // Skip 'other' type errors unless critical
    if (error.type === 'other' && buildErrors.length > 10) {
      continue;
    }

    const fixResult = await fixSingleError(client, docsDir, error, buildSystem);

    if (fixResult) {
      changes.push(fixResult);
    }
  }

  const summary =
    changes.length > 0
      ? `Fixed ${changes.length} error${changes.length === 1 ? '' : 's'}: ${changes.map((c) => c.change).join(', ')}`
      : 'No fixes applied';

  console.log(`[doc-fixer] ${summary}`);

  return {
    fixed: changes.length > 0,
    fixedCount: changes.length,
    summary,
    changes,
  };
}

async function fixSingleError(
  client: Anthropic,
  docsDir: string,
  error: BuildError,
  buildSystem: string
): Promise<{ file: string; change: string } | null> {
  const filePath = path.join(docsDir, '..', error.file);
  const absolutePath = path.resolve(filePath);
  const normalizedDocsDir = path.resolve(docsDir);

  // Safety check: ensure path is within docs directory
  if (!absolutePath.startsWith(normalizedDocsDir)) {
    console.log(`[doc-fixer] Skipping ${error.file} (outside docs directory)`);
    return null;
  }

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    console.log(`[doc-fixer] Skipping ${error.file} (file not found)`);
    return null;
  }

  try {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const prompt = buildFixPrompt(error, content, buildSystem);

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    if (responseText.includes('FIXED_CONTENT:')) {
      const [, fixedContent] = responseText.split('FIXED_CONTENT:');
      const trimmedContent = fixedContent.trim();

      fs.writeFileSync(absolutePath, trimmedContent, 'utf-8');
      const changeDesc = extractChangeDescription(responseText);

      console.log(`[doc-fixer] Fixed ${error.file}: ${changeDesc}`);

      return {
        file: error.file,
        change: changeDesc,
      };
    }

    return null;
  } catch (err) {
    console.error(
      `[doc-fixer] Error fixing ${error.file}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

function buildFixPrompt(error: BuildError, content: string, buildSystem: string): string {
  return `You are a documentation fixer. A build check found an error in a Markdown file.

BUILD SYSTEM: ${buildSystem}
ERROR TYPE: ${error.type}
ERROR MESSAGE: ${error.message}
${error.line ? `LINE NUMBER: ${error.line}` : ''}

FILE CONTENT:
\`\`\`
${content.split('\n').slice(0, 100).join('\n')}
\`\`\`
${content.split('\n').length > 100 ? '... (truncated)' : ''}

TASK:
1. Analyze what caused this error
2. Determine the minimal fix needed
3. Apply the fix to the file content

If you fix it, respond EXACTLY with:
FIX_DESCRIPTION: [one sentence describing what you fixed]
FIXED_CONTENT:
[the corrected file content here, preserving all unchanged content]

If you cannot fix it safely, respond with:
CANNOT_FIX: [reason why]
`;
}

function extractChangeDescription(response: string): string {
  const match = response.match(/FIX_DESCRIPTION:\s*(.+)/);
  if (match) {
    return match[1].trim();
  }
  return 'Applied fix';
}

// Flue agent wrapper
export default async function docFixerAgent({ payload }: FlueContext): Promise<FixResult> {
  return runDocFixer(payload as DocFixerPayload);
}
