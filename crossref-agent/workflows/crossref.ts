import 'dotenv/config.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as v from 'valibot';
import type { FlueContext, FlueSession } from '@flue/runtime';
import pageLinkerAgent from '../agents/page-linker.js';
import { loadConfig } from '../tools/config-loader.js';
import { loadState, saveState, emptyState } from '../tools/state-store.js';
import { parseSidebars } from '../tools/sidebar-parser.js';
import {
  createValidateAnchorTool,
  createExtractPageStructureTool,
  createGetAdjacentPagesTool,
} from '../tools/metadata-extractor.js';
import { createSearchPagesTool } from '../tools/page-search.js';
import { createContentSearchTool } from '../tools/content-search.js';
import {
  extractTitle, extractExistingLinks, computeSafeZones,
  parseFrontmatter, extractCodeBlockIdentifiers,
} from '../tools/markdown-parser.js';
import { validateSuggestion, hasAnchorInTarget } from '../tools/link-validator.js';
import { insertInlineLink, insertSeeAlsoEntry, findAnchorWithFallback } from '../tools/link-inserter.js';
import {
  PageAnalysisOutput, SectionClassificationOutput,
  type CrossrefState, type LinkSuggestion, type Confidence,
} from '../tools/schemas.js';

const CONFIDENCE_ORDER: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

function meetsThreshold(c: Confidence, threshold: Confidence): boolean {
  return CONFIDENCE_ORDER[c] >= CONFIDENCE_ORDER[threshold];
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

function updateFrontmatterLocal(content: string, metadata: { description: string; keywords: string[] }): string {
  // Use same regex as parseFrontmatter to ensure consistent detection (Issue #9 fix: allow EOF after ---)
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

type SectionType = 'reference' | 'guide' | 'tutorial' | 'overview' | 'other';

function walkDocs(docsDir: string, excludePatterns: string[]): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    let entries: any[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e: any) {
      console.warn(`[reindex] Skipping unreadable directory ${dir}: ${e.message}`);
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const rel = path.relative(docsDir, fullPath);
      if (excludePatterns.some(p => rel.includes(p))) continue;
      if (entry.isDirectory()) { walk(fullPath); continue; }
      if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) results.push(fullPath);
    }
  }
  walk(docsDir);
  return results;
}

function pageIdFromPath(absPath: string, docsDir: string): string {
  return path.relative(docsDir, absPath)
    .replace(/\.(md|mdx)$/, '')
    .replace(/\\/g, '/');  // Normalize backslashes to forward slashes (Windows compatibility)
}

async function reindex(
  docsDir: string,
  state: CrossrefState,
  session: FlueSession
): Promise<CrossrefState> {
  const config = loadConfig(docsDir);
  const files = walkDocs(docsDir, config.excludePatterns);

  console.log(`[reindex] Found ${files.length} docs files`);

  // Load sidebars to build adjacent pages map
  const sidebarPath = path.join(docsDir, '..', '..', 'website', 'sidebars.js');
  const adjacentMap = fs.existsSync(sidebarPath)
    ? parseSidebars(sidebarPath)
    : {};
  console.log(`[reindex] Loaded ${Object.keys(adjacentMap).length} pages from sidebars`);

  // Build index entries - pull description and keywords from frontmatter
  const index = files.map(absPath => {
    let content: string;
    try {
      content = fs.readFileSync(absPath, 'utf-8');
    } catch (e: any) {
      console.warn(`[reindex] Skipping unreadable file ${absPath}: ${e.message}`);
      return null as any;
    }
    const rel = path.relative(docsDir, absPath);
    const fm = parseFrontmatter(content);

    return {
      id: pageIdFromPath(absPath, docsDir),
      title: extractTitle(content, path.basename(absPath, path.extname(absPath))),
      path: rel,
      absPath,
      description: fm.description || null,
      keywords: Array.isArray(fm.keywords) && fm.keywords.length > 0 ? fm.keywords : null,
      existingLinkCount: extractExistingLinks(content).length,
      adjacentPages: adjacentMap[pageIdFromPath(absPath, docsDir)] || [],
    };
  }).filter(e => e !== null);

  // Issue #6 fix: Clean up processed list to only include IDs still in the index
  // This prevents stale pageIds (from deleted files) from being marked as processed
  // Issue #8 fix: Preserve count of removed IDs for logging, but continue processing from remaining
  const currentPageIds = new Set(index.map(e => e.id));
  const orphanedCount = state.processed.length;
  const cleanedProcessed = state.processed.filter(id => currentPageIds.has(id));
  const actualOrphanedCount = orphanedCount - cleanedProcessed.length;

  const newState: CrossrefState = {
    ...state,
    indexBuiltAt: new Date().toISOString(),
    docsDir,
    index,
    processed: cleanedProcessed, // Keep only IDs that are still in the index
  };

  saveState(docsDir, newState);
  console.log(`[reindex] Index built: ${index.length} pages. Progress preserved: ${cleanedProcessed.length} pages already processed (${actualOrphanedCount} orphaned IDs removed).`);
  return newState;
}

function printIterationSummary(
  pageTitle: string,
  processed: number,
  total: number,
  applied: number,
  queued: number,
  thisIn: number,
  thisOut: number,
  totalIn: number,
  totalOut: number,
  totalCost: number
) {
  console.log(
    `✓ Processed: ${pageTitle} (${processed}/${total})  |  Applied: ${applied} links  |  Queued: ${queued}`
  );
  console.log(`  Tokens this run — in: ${thisIn.toLocaleString()}  out: ${thisOut.toLocaleString()}`);
  console.log(
    `  Tokens total    — in: ${totalIn.toLocaleString()}  out: ${totalOut.toLocaleString()}  (~$${totalCost.toFixed(2)})`
  );
}

// Cost estimate for claude-haiku-4-5 ($0.80/M input, $4/M output)
function estimateCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * 0.8 + (outputTokens / 1_000_000) * 4.0;
}

async function processBatch(
  state: CrossrefState,
  config: ReturnType<typeof loadConfig>,
  session: FlueSession,
  batchSize: number,
  docsDir: string,
  targetFile?: string,
  targetDir?: string
): Promise<{ done: boolean; processed: number; remaining: number }> {
  let batch;

  if (targetFile) {
    // Find specific target file by path (relative or absolute)
    const normalizedTarget = path.isAbsolute(targetFile) ? targetFile : path.resolve(docsDir, targetFile);
    // Issue #4 fix: Validate that normalized path stays within docsDir (path traversal prevention)
    let realDocsDir: string;
    try {
      realDocsDir = fs.realpathSync(docsDir);
    } catch {
      // docsDir doesn't exist or is inaccessible
      console.warn(`[crossref] Docs directory not accessible: ${docsDir}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    let realTarget: string;
    try {
      realTarget = fs.realpathSync(normalizedTarget);
    } catch {
      // File doesn't exist or is inaccessible
      console.warn(`[crossref] Target file not accessible: ${targetFile}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    // Verify the resolved path is within docsDir
    if (!realTarget.startsWith(realDocsDir + path.sep) && realTarget !== realDocsDir) {
      console.warn(`[crossref] Target file is outside docsDir: ${targetFile}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    // Find target entry by absolute path (most reliable), normalize both for comparison
    const normalizedTargetForLookup = path.normalize(normalizedTarget);
    const targetEntry = state.index.find(e => {
      const normalizedAbsPath = path.normalize(e.absPath);
      return normalizedAbsPath === normalizedTargetForLookup;
    });

    if (!targetEntry) {
      console.warn(`[crossref] Target file not found in index: ${targetFile}`);
      console.warn(`[crossref] Available files: ${state.index.map(e => e.path).join(', ')}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }

    batch = [targetEntry];
  } else if (targetDir) {
    // Find all files in target directory and subdirectories
    let normalizedDir = path.isAbsolute(targetDir) ? targetDir : path.resolve(docsDir, targetDir);
    // Issue #5 fix: Validate that normalized path stays within docsDir (path traversal prevention)
    let realDocsDir: string;
    try {
      realDocsDir = fs.realpathSync(docsDir);
    } catch {
      // docsDir doesn't exist or is inaccessible
      console.warn(`[crossref] Docs directory not accessible: ${docsDir}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    let realTargetDir: string;
    try {
      realTargetDir = fs.realpathSync(normalizedDir);
    } catch {
      // Directory doesn't exist or is inaccessible
      console.warn(`[crossref] Target directory not accessible: ${targetDir}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    // Verify the resolved path is within docsDir
    if (!realTargetDir.startsWith(realDocsDir + path.sep) && realTargetDir !== realDocsDir) {
      console.warn(`[crossref] Target directory is outside docsDir: ${targetDir}`);
      return { done: false, processed: 0, remaining: state.index.length };
    }
    // Remove trailing slash if present to avoid double slash
    normalizedDir = normalizedDir.replace(/[/\\]$/, '');
    const filesInDir = state.index.filter(e => {
      return e.absPath.startsWith(normalizedDir + path.sep);
    });

    if (filesInDir.length === 0) {
      console.warn(`[crossref] No files found in target directory: ${targetDir}`);
      console.warn(`[crossref] Indexed directories: ${new Set(state.index.map(e => path.dirname(e.path))).size} found`);
      return { done: false, processed: 0, remaining: state.index.length };
    }

    // Process up to batchSize files from the directory
    batch = filesInDir.slice(0, batchSize);
  } else {
    // Default behavior: process next unprocessed pages
    const unprocessed = state.index.filter(e => !state.processed.includes(e.id));
    if (unprocessed.length === 0) return { done: true, processed: 0, remaining: 0 };
    batch = unprocessed.slice(0, batchSize);
  }

  // Issue #5 fix: Keep initial state.suggestions for deduplication before clearing batch suggestions
  // Issue #4 fix: In single-file mode, only clear suggestions where targetFile is the SOURCE
  // Don't clear suggestions where it's the TARGET (A→B), as clearing both directions is unintended
  // Single-file mode should only remove stale suggestions FROM that file
  // In batch mode with config.clearSuggestionsBeforeRun, clear both directions per config
  const initialStateSuggestions = [...state.suggestions];
  if (targetFile || config.clearSuggestionsBeforeRun) {
    const batchIds = new Set(batch.map(e => e.id));
    const beforeCount = state.suggestions.length;

    if (targetFile) {
      // Single-file mode: only clear suggestions ORIGINATING from targetFile (sourceId in batchIds)
      // Keep suggestions pointing TO this file (targetId in batchIds) as those are valid incoming links
      state.suggestions = state.suggestions.filter(
        s => !batchIds.has(s.sourceId)
      );
    } else {
      // Batch mode with clearSuggestionsBeforeRun: clear both directions for consistency
      // Issue #8 fix: Clear both source and target references to avoid stale suggestions
      state.suggestions = state.suggestions.filter(
        s => !batchIds.has(s.sourceId) && !batchIds.has(s.targetId)
      );
    }

    const clearedCount = beforeCount - state.suggestions.length;
    if (clearedCount > 0) {
      console.log(`[DEBUG] Cleared ${clearedCount} suggestions for ${batchIds.size} files being re-processed`);
    }
  }

  for (const pageEntry of batch) {
    let pageContent = fs.readFileSync(pageEntry.absPath, 'utf-8');

    // PREREQUISITE: Extract missing metadata before agent analysis
    const pageFrontmatter = parseFrontmatter(pageContent);
    // Issue #4 fix: Check that description is not null/undefined, empty string is valid
    const hasBothFields =
      pageFrontmatter.description !== null &&
      pageFrontmatter.description !== undefined &&
      typeof pageFrontmatter.description === 'string' &&
      Array.isArray(pageFrontmatter.keywords) &&
      pageFrontmatter.keywords.length > 0;
    if (!hasBothFields) {
      console.log(`[crossref] Extracting missing metadata for ${pageEntry.id}...`);
      try {
        const metadataResult = await session.prompt(
          `Extract metadata from this documentation page.

Page title: ${pageEntry.title}
Page path: ${pageEntry.path}

Content:
${pageContent}

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
- Focus on what users would search for`,
          {
            result: v.object({
              description: v.string(),
              keywords: v.array(v.string()),
            })
          }
        );

        const metadata = metadataResult.data;
        const updatedContent = updateFrontmatterLocal(pageContent, metadata);
        fs.writeFileSync(pageEntry.absPath, updatedContent, 'utf-8');
        pageContent = updatedContent;
        pageEntry.description = metadata.description;
        pageEntry.keywords = metadata.keywords;
        console.log(`[crossref] Metadata extracted and written for ${pageEntry.id}`);
      } catch (e) {
        console.warn(`[crossref] Failed to extract metadata for ${pageEntry.id}:`, e);
        // Continue processing without metadata - don't crash the batch
      }
    }

    // Minimal index - only id, title, path
    const minimalIndex = state.index.map(e => ({
      id: e.id,
      title: e.title,
      path: e.path,
    }));
    const indexJson = JSON.stringify(minimalIndex);

    // Readable page list for quick reference
    const pageList = state.index
      .map(e => `${e.id} — ${e.title}`)
      .join('\n');

    const adjacentPagesInfo = pageEntry.adjacentPages.length > 0
      ? `\nAdjacent pages (same documentation section): ${pageEntry.adjacentPages.join(', ')}`
      : '';

    // Extract technical terms from code blocks for See Also analysis
    const codeBlockTerms = extractCodeBlockIdentifiers(pageContent);
    const codeBlockContext = codeBlockTerms.length > 0
      ? `\nTechnical terms found in code blocks (use for See Also suggestions): ${codeBlockTerms.join(', ')}`
      : '';

    const prompt = `Analyze the page content below for cross-link opportunities.
Config: maxLinksPerPage=${config.maxLinksPerPage}, maxSeeAlsoSuggestion=${config.maxSeeAlsoSuggestion}

Page index (all available pages):
${pageList}

Structured index (JSON):
${indexJson}
${adjacentPagesInfo}
${codeBlockContext}

When generating See Also suggestions:
- Use code block technical terms to identify related pages
- Example: If code shows ZIO.acquireRelease, suggest resource management/acquire-release pages
- Prefer pages that document these code concepts

Page being analyzed (id: ${pageEntry.id}):
${pageContent}`;

    // Use session.prompt() with page-linker agent and helper tools
    // NOTE: extract_page_metadata tool is NOT included to prevent reentrant session calls
    // (Issue #3 fix). Metadata extraction happens in prerequisite and postprocessing phases.
    const tools = [
      createValidateAnchorTool(state),
      createExtractPageStructureTool(state),
      createGetAdjacentPagesTool(state),
      createSearchPagesTool(state),
      createContentSearchTool(state),
    ];
    const taskResult = await session.prompt(prompt, {
      result: PageAnalysisOutput,
      tools,
    });

    let output: v.InferOutput<typeof PageAnalysisOutput>;
    try {
      output = taskResult.data;
    } catch (e) {
      console.warn(`[crossref] Failed to parse response for ${pageEntry.id}:`, e);
      state.processed.push(pageEntry.id);
      continue;
    }

    // Extract metadata for See Also targets missing descriptions
    const seeAlsoTargets = output.suggestions
      .filter(s => s.type === 'see_also')
      .map(s => state.index.find(e => e.id === s.targetId))
      .filter((e): e is typeof state.index[0] => !!e);

    if (seeAlsoTargets.length > 0) {
      console.log(`[crossref] Extracting metadata for ${seeAlsoTargets.length} See Also targets`);
    }

    for (const target of seeAlsoTargets) {
      console.log(`[crossref] Extracting metadata for See Also target: ${target.id}`);
      try {
        const targetContent = fs.readFileSync(target.absPath, 'utf-8');

        // Skip if frontmatter already has both fields (mirrors source-page logic at lines 362-370)
        const fm = parseFrontmatter(targetContent);
        const hasMetadata =
          fm.description !== null &&
          fm.description !== undefined &&
          typeof fm.description === 'string' &&
          Array.isArray(fm.keywords) &&
          fm.keywords.length > 0;
        if (hasMetadata) {
          // Sync index entry from disk in case it was stale
          target.description = fm.description;
          target.keywords = fm.keywords;
          console.log(`[crossref] Skipping extraction for ${target.id} (metadata already present)`);
          continue;
        }

        const metadataResult = await session.prompt(
          `Extract metadata from this documentation page.

Page title: ${target.title}
Page path: ${target.path}

Content:
${targetContent}

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
- Focus on what users would search for`,
          {
            result: v.object({
              description: v.string(),
              keywords: v.array(v.string()),
            })
          }
        );
        const metadata = metadataResult.data;
        const updatedContent = updateFrontmatterLocal(targetContent, metadata);
        fs.writeFileSync(target.absPath, updatedContent, 'utf-8');
        target.description = metadata.description;
        target.keywords = metadata.keywords;

        // Update suggestions with extracted descriptions
        output.suggestions
          .filter(s => s.type === 'see_also' && s.targetId === target.id)
          .forEach(s => s.description = metadata.description);
      } catch (e) {
        console.warn(`[crossref] Failed to extract metadata for ${target.id}:`, e);
      }
    }

    // Enrich suggestions: compute targetRelativePath deterministically, set status
    const newSuggestions: LinkSuggestion[] = [];
    console.log(`[DEBUG] Output has ${output.suggestions.length} suggestions`);
    for (const raw of output.suggestions) {
      const targetEntry = state.index.find(e => e.id === raw.targetId);
      if (!targetEntry) {
        console.log(`[DEBUG] Skipping suggestion (target not in index): ${raw.targetId}`);
        continue;
      }

      let targetRelativePath = path.relative(
        path.dirname(pageEntry.absPath),
        targetEntry.absPath
      );
      // Issue #2 fix: Normalize Windows backslashes to forward slashes for markdown links
      // Handle both single and multiple backslashes (including UNC paths with \\)
      targetRelativePath = targetRelativePath.replace(/\\/g, '/').replace(/\/+/g, '/');

      // Deduplicate: skip if (sourceId, targetId) already in state (use initial state for consistency)
      const alreadyExists = initialStateSuggestions.some(
        s => s.sourceId === pageEntry.id && s.targetId === raw.targetId
      );
      if (alreadyExists) {
        console.log(`[DEBUG] Skipping suggestion (already exists in state): ${raw.targetId}`);
        continue;
      }

      console.log(`[DEBUG] Adding suggestion to newSuggestions: ${raw.targetId} (${raw.type}, ${raw.confidence})`);
      newSuggestions.push({
        sourceId: pageEntry.id,
        targetId: raw.targetId,
        targetTitle: raw.targetTitle,
        targetRelativePath,
        anchorText: raw.anchorText,
        description: raw.description,
        type: raw.type,
        confidence: raw.confidence,
        reasoning: raw.reasoning,
        status: 'pending',
      });
    }

    state.suggestions.push(...newSuggestions);
    state.processed.push(pageEntry.id);

    // Accumulate token usage (Flue exposes usage on task result)
    const usage = (taskResult as any).usage ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    state.tokens.inputTotal += usage.input ?? 0;
    state.tokens.outputTotal += usage.output ?? 0;
    state.tokens.runningCost = estimateCost(state.tokens.inputTotal, state.tokens.outputTotal);

    // Apply high-confidence suggestions immediately
    let thisApplied = 0;
    let thisQueued = 0;
    let currentContent = pageContent;
    const processedTargets = new Set<string>();

    // Combine newly generated suggestions with existing pending high-confidence ones
    // Issue #3 fix: Create fresh references to avoid losing status mutations if saveState fails
    // Issue #6 fix: Create copies of existing high-confidence suggestions to avoid modifying original state
    // until we've successfully persisted the changes
    const existingHighConfidence = state.suggestions.filter(
      s => s.sourceId === pageEntry.id &&
           s.status === 'pending' &&
           s.confidence === 'high'
    );
    const suggestionsToProcess = [
      ...newSuggestions,
      ...existingHighConfidence.map(s => ({ ...s }))  // Create shallow copies to prevent in-place mutations
    ];
    console.log(`[DEBUG] suggestionsToProcess has ${suggestionsToProcess.length} total (${newSuggestions.length} new + ${existingHighConfidence.length} existing high-confidence)`);

    for (const processedSuggestion of suggestionsToProcess) {
      // Skip if we already processed a suggestion for this target on this page (first-occurrence deduplication)
      if (processedTargets.has(processedSuggestion.targetId)) {
        console.log(`[DEBUG] Skipping duplicate target: ${processedSuggestion.targetId} (already processed first occurrence)`);
        processedSuggestion.status = 'skipped';
        continue;
      }
      console.log(`[DEBUG] Processing suggestion: ${processedSuggestion.anchorText} (${processedSuggestion.type}, ${processedSuggestion.confidence})`);

      if (!meetsThreshold(processedSuggestion.confidence, config.confidenceThreshold)) {
        console.log(`[DEBUG]   → Below confidence threshold (${processedSuggestion.confidence} < ${config.confidenceThreshold})`);
        thisQueued++;
        continue;
      }
      console.log(`[DEBUG]   → Meets confidence threshold`);

      // Mark target as processed to prevent duplicate suggestions for same target (even if this one fails)
      processedTargets.add(processedSuggestion.targetId);

      // Issue #3 fix: Recompute safe zones for current content state (content may have been modified by previous suggestions)
      // Compute safe zones: do NOT include inline code in safe zones (allows linking to inline code)
      // The safe zones should only protect code blocks and headers (Issue #8 fix)
      const safeZonesWithInlineCode = computeSafeZones(currentContent, { includeInlineCode: false });
      console.log(`[DEBUG]   → Safe zones: ${safeZonesWithInlineCode.length} zones (with inline code protection)`);

      const validation = validateSuggestion(processedSuggestion, currentContent, docsDir, pageEntry.absPath);
      console.log(`[DEBUG]   → Validation: ${validation.ok ? 'PASS' : 'FAIL'} ${validation.ok ? '' : `(${validation.reason})`}`);

      if (!validation.ok) {
        processedSuggestion.status = 'skipped';
        console.warn(`  ⚠ Skipped (${validation.reason}): ${processedSuggestion.sourceId} → ${processedSuggestion.targetId}`);
        continue;
      }

      // Promote medium-confidence suggestions to high if anchor text is clearly findable
      if (processedSuggestion.confidence === 'medium' && processedSuggestion.type === 'inline') {
        // Check if anchor text exists in the document with proper word boundaries
        const anchorMatch = findAnchorWithFallback(currentContent, processedSuggestion.anchorText, 0, safeZonesWithInlineCode);
        if (anchorMatch) {
          processedSuggestion.confidence = 'high';
          console.log(`[DEBUG]   → ↑ Promoted to high-confidence (anchor text found)`);
        }
      }

      // For inline code suggestions with methods/operators, verify anchor exists on target
      if (processedSuggestion.type === 'inline' && (processedSuggestion.anchorText.includes('.') || processedSuggestion.anchorText.includes('#'))) {
        console.log(`[DEBUG]   → Checking anchor for method/operator: ${processedSuggestion.anchorText}`);
        const targetEntry = state.index.find(e => e.id === processedSuggestion.targetId);
        if (targetEntry) {
          const hasAnchor = hasAnchorInTarget(targetEntry.absPath, processedSuggestion.anchorText);
          console.log(`[DEBUG]     → Has anchor: ${hasAnchor}`);
          if (!hasAnchor) {
            processedSuggestion.status = 'skipped';
            console.warn(`  ⚠ Skipped (no anchor): ${processedSuggestion.anchorText} in ${targetEntry.title}`);
            continue;
          }
        } else {
          console.log(`[DEBUG]     → Target entry not found`);
        }
      }

      let inserted = false;
      if (processedSuggestion.type === 'inline') {
        console.log(`[DEBUG]   → Attempting inline link insertion for "${processedSuggestion.anchorText}"`);
        const r = insertInlineLink(currentContent, processedSuggestion.anchorText, processedSuggestion.targetRelativePath, safeZonesWithInlineCode);
        console.log(`[DEBUG]     → Result: inserted=${r.inserted}, reason=${r.reason || 'none'}`);
        if (r.inserted) {
          currentContent = r.result;
          inserted = true;
          console.log(`[DEBUG]     → Content updated, new length=${currentContent.length}`);
        }
        else console.warn(`  ⚠ Could not insert inline link: ${r.reason}`);
      } else {
        if (!processedSuggestion.description) {
          console.log(`[DEBUG]   → Skipping see-also (missing required description)`);
          processedSuggestion.status = 'skipped';
          continue;
        }
        console.log(`[DEBUG]   → Attempting see-also insertion for "${processedSuggestion.anchorText}"`);
        const r = insertSeeAlsoEntry(currentContent, processedSuggestion.anchorText, processedSuggestion.targetRelativePath, processedSuggestion.description, safeZonesWithInlineCode);
        console.log(`[DEBUG]     → Result: inserted=${r.inserted}, reason=${r.reason || 'none'}`);
        if (r.inserted) {
          currentContent = r.result;
          inserted = true;
          console.log(`[DEBUG]     → Content updated, new length=${currentContent.length}`);
        }
      }

      if (inserted) {
        processedSuggestion.status = 'applied';
        thisApplied++;
        console.log(`[DEBUG]   → APPLIED (total applied: ${thisApplied})`);
      } else {
        processedSuggestion.status = 'skipped';
        console.log(`[DEBUG]   → SKIPPED`);
      }

      // Issue #6 fix: Update the original state.suggestions with the processed status
      // Don't match on anchorText since findAnchorWithFallback may have transformed it
      // (e.g., 'Console Service' → 'console' via fallback strategies)
      // Match only on sourceId and targetId which are stable identifiers
      const originalSuggestion = state.suggestions.find(
        s => s.sourceId === processedSuggestion.sourceId &&
             s.targetId === processedSuggestion.targetId
      );
      if (originalSuggestion) {
        originalSuggestion.status = processedSuggestion.status;
        originalSuggestion.confidence = processedSuggestion.confidence;
      }
    }

    // Write modified content back to disk
    if (currentContent !== pageContent) {
      fs.writeFileSync(pageEntry.absPath, currentContent, 'utf-8');
    }

    const remaining = state.index.filter(e => !state.processed.includes(e.id)).length;
    printIterationSummary(
      pageEntry.title,
      state.processed.length,
      state.index.length,
      thisApplied,
      thisQueued,
      usage.input ?? 0,
      usage.output ?? 0,
      state.tokens.inputTotal,
      state.tokens.outputTotal,
      state.tokens.runningCost
    );

    saveState(docsDir, state);
  }

  const remaining = state.index.filter(e => !state.processed.includes(e.id)).length;
  return { done: remaining === 0, processed: batch.length, remaining };
}

export async function run({ init, payload }: FlueContext) {
  const { docsDir, mode, batchSize = 1, targetFile, targetDir } = payload as {
    docsDir: string;
    mode: 'reindex' | 'step' | 'autopilot' | 'report';
    batchSize?: number;
    targetFile?: string;
    targetDir?: string;
  };

  if (!docsDir) throw new Error('payload.docsDir is required');

  const harness = await init(pageLinkerAgent, { name: 'crossref' });
  const session = await harness.session();

  let state = (await loadState(docsDir)) ?? emptyState(docsDir);

  if (mode === 'reindex') {
    state = await reindex(docsDir, state, session);
    return { indexed: state.index.length };
  }

  if (mode === 'step') {
    if (state.index.length === 0) {
      console.log('[crossref] No index found. Run reindex first.');
      return { done: false };
    }
    const config = loadConfig(docsDir);
    const result = await processBatch(state, config, session, batchSize, docsDir, targetFile, targetDir);
    if (result.done) console.log('[crossref] All pages processed.');
    return result;
  }

  if (mode === 'autopilot') {
    if (state.index.length === 0) {
      console.log('[crossref] No index found. Run reindex first.');
      return { done: false };
    }
    const config = loadConfig(docsDir);
    let totalProcessed = 0;
    while (true) {
      const result = await processBatch(state, config, session, batchSize, docsDir, targetFile, targetDir);
      totalProcessed += result.processed;
      if (result.done) break;
      // reload state after each batch (saveState was called inside processBatch)
      state = (await loadState(docsDir)) ?? state;
    }
    console.log(`\n[crossref] Autopilot complete. Total processed: ${totalProcessed}/${state.index.length}`);
    console.log(`  Total tokens — in: ${state.tokens.inputTotal.toLocaleString()}  out: ${state.tokens.outputTotal.toLocaleString()}  (~$${state.tokens.runningCost.toFixed(2)})`);
    return { done: true, totalProcessed };
  }

  if (mode === 'report') {
    const config = loadConfig(docsDir);
    const threshold = config.confidenceThreshold;

    const applied = state.suggestions.filter(s => s.status === 'applied');
    const skipped = state.suggestions.filter(s => s.status === 'skipped');
    const pending = state.suggestions.filter(s => s.status === 'pending');
    const pendingHigh = pending.filter(s => s.confidence === 'high');
    const pendingMedium = pending.filter(s => s.confidence === 'medium');
    const pendingLow = pending.filter(s => s.confidence === 'low');
    const readyToApply = pending.filter(s => meetsThreshold(s.confidence, threshold));

    // Overall statistics
    const totalPages = state.index.length;
    const totalApplied = applied.length;

    // Orphan detection: pages with no applied or ready-to-apply incoming link
    const linkedTargets = new Set([
      ...applied.map(s => s.targetId),
      ...readyToApply.map(s => s.targetId),
    ]);
    const orphans = state.index.filter(e => !linkedTargets.has(e.id));

    const lines: string[] = [
      ``,
      `Cross-Reference Coverage Report  (confidenceThreshold: ${threshold})`,
      `=`.repeat(60),
      `Total pages:   ${state.index.length}`,
      `Processed:     ${state.processed.length} (${Math.round(state.processed.length / state.index.length * 100)}%)`,
      `Pending:       ${state.index.length - state.processed.length}`,
      ``,
      `Suggestions:`,
      `  applied:  ${applied.length}`,
      `  skipped:  ${skipped.length}`,
      `  pending:  ${pending.length}  (${pendingHigh.length} high, ${pendingMedium.length} medium, ${pendingLow.length} low)`,
      readyToApply.length > 0
        ? `             ^--- ${readyToApply.length} meet threshold — run 'step' or 'autopilot' to apply`
        : `             ^--- none meet threshold`,
      ``,
      `Overall applied links: ${totalApplied} / ${totalPages} pages have outgoing links`,
      ``,
      `Orphan pages (no incoming applied or pending-${threshold} links): ${orphans.length}`,
      ...orphans.slice(0, 10).map(e => `  - ${e.path}`),
      orphans.length > 10 ? `  (${orphans.length - 10} more...)` : '',
      ``,
      `Token spend to date: in ${state.tokens.inputTotal.toLocaleString()}  out ${state.tokens.outputTotal.toLocaleString()}  (~$${state.tokens.runningCost.toFixed(2)})`,
      ``,
    ];

    console.log(lines.filter(l => l !== undefined).join('\n'));
    return { orphans: orphans.length, applied: applied.length, pending: pending.length };
  }

  throw new Error(`Unknown mode: "${mode}"`);
}
