import 'dotenv/config.js';
import * as fs from 'node:fs';
import type { FlueContext } from '@flue/runtime';
import { runExamplesPhase, type DocType } from './phases/examples.js';

export type { DocType };

export interface WriteExamplesResult {
  success: boolean;
  moduleName: string;
  packageDir: string;
  exampleFiles: string[];
  compileSuccess: boolean;
  compileOutput: string;
  lintSuccess: boolean;
  lintOutput: string;
  documentationAdded: boolean;
  durationMs: number;
}

export async function run({ init, payload }: FlueContext) {
  const {
    projectRoot,
    moduleName,
    topic,
    docType,
    outputDocPath,
    packageName,
    parentModule,
  } = payload as {
    projectRoot: string;
    moduleName: string;
    topic: string;
    docType: DocType;
    outputDocPath?: string;
    packageName?: string;
    /** If set, creates a self-contained sbt sub-project under {parentModule}/{moduleName}/. */
    parentModule?: string;
  };

  if (!projectRoot) throw new Error('payload.projectRoot is required');
  if (!moduleName) throw new Error('payload.moduleName is required');
  if (!topic) throw new Error('payload.topic is required');
  if (!docType) throw new Error('payload.docType is required');
  if (!fs.existsSync(projectRoot)) throw new Error(`projectRoot not found: ${projectRoot}`);

  const validDocTypes: DocType[] = ['data-type-ref', 'tutorial', 'how-to-guide', 'module-ref'];
  if (!validDocTypes.includes(docType)) {
    throw new Error(`docType must be one of: ${validDocTypes.join(', ')}`);
  }

  console.log(`[write-examples] projectRoot:   ${projectRoot}`);
  console.log(`[write-examples] parentModule:  ${parentModule ?? '(flat — root level)'}`);
  console.log(`[write-examples] outputDocPath: ${outputDocPath ?? '(not provided)'}`);

  const result = await runExamplesPhase(init, {
    projectRoot,
    moduleName,
    topic,
    docType,
    outputDocPath,
    packageName,
    parentModule,
  });

  const { success, exampleFiles, compileSuccess, lintSuccess, documentationAdded, durationMs } =
    result;

  console.log(`\n[write-examples] ${success ? '✓ SUCCESS' : '⚠ PARTIAL'} (${durationMs}ms)`);
  console.log(`  Examples:  ${exampleFiles.length} files`);
  console.log(`  Compile:   ${compileSuccess ? '✓' : '✗'}`);
  console.log(`  Lint:      ${lintSuccess ? '✓' : '✗'}`);
  console.log(`  Docs:      ${documentationAdded ? '✓' : '—'}`);

  return result satisfies WriteExamplesResult;
}
