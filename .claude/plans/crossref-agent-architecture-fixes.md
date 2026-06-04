# Plan: Fix Critical Architecture Issues in Crossref Agent

**Date:** 2026-06-04  
**Status:** Pending  
**Priority:** Critical (8 findings: 4 data loss / persistence issues, 4 correctness / safety issues)

---

## Executive Summary

The crossref-agent system has 8 critical architectural bugs that cause:
- **Data loss:** Keywords and descriptions drop from state persistence
- **Token waste:** Infinite re-extraction loops due to parsing failures
- **Silent failures:** Links validated but not inserted; anchor text divergence
- **Progress loss:** Autopilot reindexing wipes all processing history
- **Deadlock risk:** Reentrant session.prompt() calls from tool callbacks

**Fix order:** Parse → State → Reindex → Safe zones → Link insertion → Validation → Quotes → Session

---

## Findings (Ranked by Severity)

### 1. CRITICAL: parseFrontmatter silently drops multi-line YAML arrays

**File:** `crossref-agent/tools/markdown-parser.ts`, line 12  
**Severity:** Critical — causes infinite re-extraction + token waste  
**Impact:** Every page re-extracted on every autopilot run

**Problem:**
```typescript
const m = line.match(/^([a-zA-Z_]+):\s*(.+)$/);
```
This regex only matches `key: scalar_value` on a single line. YAML arrays written by the system:
```yaml
keywords:
  - "ZIO Streams"
  - "Resource Management"
```
The `keywords:` line has no value after the colon, and list items don't match the key pattern. Result: `fm.keywords = undefined`.

**Round-trip corruption:**
1. `updateFrontmatter` writes keywords list to disk
2. `parseFrontmatter` reads it back and loses the array
3. `reindex` stores `null` for keywords
4. Next run: cache check fails, re-extracts for the same page

**Fix:**
Replace regex parser with proper YAML library (`js-yaml`):
```typescript
import YAML from 'js-yaml';

export function parseFrontmatter(content: string): Record<string, any> {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fmMatch) return {};
  try {
    return YAML.load(fmMatch[1]) || {};
  } catch (e) {
    console.warn('Failed to parse YAML frontmatter:', e);
    return {};
  }
}
```

Or manually extend regex to handle list items:
```typescript
const fm: Record<string, any> = {};
const lines = fmMatch[1].split('\n');
let currentKey: string | null = null;
let currentArray: string[] = [];

for (const line of lines) {
  const scalarMatch = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
  if (scalarMatch) {
    if (currentKey && currentArray.length > 0) fm[currentKey] = currentArray;
    currentKey = scalarMatch[1];
    currentArray = scalarMatch[2] ? [scalarMatch[2]] : [];
  } else if (currentKey && line.match(/^\s*-\s+/)) {
    const item = line.match(/^\s*-\s+(.*)$/)?.[1];
    if (item) currentArray.push(item);
  }
}
if (currentKey && currentArray.length > 0) fm[currentKey] = currentArray;
return fm;
```

**Return type change:**
Change return type from `Record<string, string>` to `Record<string, string | string[]>` to reflect array support.

---

### 2. CRITICAL: saveState() omits description and keywords from index serialization

**File:** `crossref-agent/tools/state-store.ts`, line 109–116  
**Severity:** Critical — breaks autopilot reload cycle  
**Impact:** Metadata extracted but not persisted; causes re-extraction

**Problem:**
```typescript
index: state.index.map(entry => ({
  id: entry.id,
  title: entry.title,
  path: entry.path,
  absPath: entry.absPath,
  existingLinkCount: entry.existingLinkCount,
})),
```
The `description` and `keywords` fields are explicitly omitted from serialization. In autopilot mode, state is reloaded from disk after each batch. Reloaded state has `description: null, keywords: null` even if files were updated.

**Autopilot impact:**
1. Extract metadata for page A, write to disk and update `state.index[A].description`
2. `saveState()` runs — description field is omitted
3. `loadState()` runs on next batch — description is null again
4. `extract_page_metadata` tool checks `entry.description && entry.keywords`, sees false, re-extracts

**Fix:**
Include these fields in serialization:
```typescript
index: state.index.map(entry => ({
  id: entry.id,
  title: entry.title,
  path: entry.path,
  absPath: entry.absPath,
  description: entry.description || null,
  keywords: entry.keywords || [],
  existingLinkCount: entry.existingLinkCount,
})),
```

And update `loadState()` to read them back:
```typescript
const loaded: CrossrefState = {
  ...data,
  index: data.index.map((entry: any) => ({
    ...entry,
    description: entry.description || null,
    keywords: entry.keywords || [],
  })),
};
```

---

### 3. CRITICAL: extract_page_metadata calls session.prompt() from tool callback — reentrant LLM session

**File:** `crossref-agent/tools/metadata-extractor.ts`, line 62  
**Severity:** Critical — potential deadlock or response corruption  
**Impact:** Autopilot may hang or corrupt agent output

**Problem:**
```typescript
const result = await session.prompt(prompt, { result: v.object(...) });
```
This is called from within a tool that executes during a parent `session.prompt()` call (workflows/crossref.ts:342). The Flue runtime's `FlueSession` may not support re-entrant or concurrent calls on the same session object.

**Failure scenario:**
- Agent's main `session.prompt()` request is in-flight (line 342)
- Agent invokes `extract_page_metadata` tool
- Tool calls `session.prompt()` on the same session (line 62)
- Flue's session object queues requests serially; inner call blocks waiting for outer call to complete
- Outer call waits for tool result
- Deadlock

**Fix:**
Use a separate session instance for metadata extraction. Either:

**Option A:** Pass a dedicated session to the tool:
```typescript
export function createMetadataExtractorTool(
  state: CrossrefState,
  docsDir: string,
  toolSession: FlueSession  // separate from agent's session
) {
  return defineTool({
    name: 'extract_page_metadata',
    execute: async (args: Record<string, any>) => {
      // Use toolSession, not the parent agent session
      const result = await toolSession.prompt(prompt, {...});
    }
  });
}
```

**Option B:** Move metadata extraction outside the agent loop:
```typescript
// Extract ALL missing metadata BEFORE agent processes any pages
for (const entry of state.index) {
  if (!entry.description || !entry.keywords) {
    const metadata = await extractMetadataDirectly(entry);
    entry.description = metadata.description;
    entry.keywords = metadata.keywords;
    // Write to disk immediately
    updateFileWithMetadata(entry.absPath, metadata);
  }
}
// Now run agent with metadata already populated
const agentResult = await session.prompt(agentPrompt, {...});
```

Recommend **Option B** — it also solves issue #2 (state persistence) by extracting before the batch loop.

---

### 4. CRITICAL: reindex() unconditionally resets processed:[] — mid-autopilot reindex loses all progress

**File:** `crossref-agent/workflows/crossref.ts`, line 147  
**Severity:** Critical — loses processing progress in autopilot mode  
**Impact:** Autopilot may re-process the same pages infinitely

**Problem:**
```typescript
const newState: CrossrefState = {
  ...state,
  indexBuiltAt: new Date().toISOString(),
  docsDir,
  index,
  processed: [], // <-- unconditional reset
};
saveState(docsDir, newState);
```

In autopilot mode (line 637–644), the loop calls `processBatch()` then reloads state from disk. If `reindex()` is called (external signal handler, user in another terminal, scheduled task), the reloaded state will have an empty `processed` list. The loop will treat all pages as unprocessed and restart from scratch.

**Failure scenario:**
1. Autopilot processes pages 1–50
2. External process calls `reindex()` to rebuild the index
3. Autopilot's next reload picks up `processed: []`
4. Loop restarts, re-processes pages 1–50

**Fix:**
Preserve processed pages across reindex:
```typescript
const newState: CrossrefState = {
  ...state,
  indexBuiltAt: new Date().toISOString(),
  docsDir,
  index,
  processed: state.processed, // <-- preserve processed pages
};
saveState(docsDir, newState);
```

Or require explicit opt-in for destructive reindex:
```typescript
function reindex(
  docsDir: string,
  state: CrossrefState,
  session: FlueSession,
  resetProgress: boolean = false // default: preserve
): Promise<CrossrefState> {
  // ... build index ...
  return {
    ...state,
    index,
    processed: resetProgress ? [] : state.processed,
  };
}
```

---

### 5. CRITICAL: insertSeeAlsoEntry appends after sectionEnd — corrupts markdown spacing

**File:** `crossref-agent/tools/link-inserter.ts`, line 169  
**Severity:** Critical — produces malformed markdown  
**Impact:** Next section heading renders as paragraph continuation

**Problem:**
```typescript
const sectionEnd = nextHeading === -1 ? content.length : nextHeading;
const beforeSection = content.slice(0, sectionEnd).trimEnd();
const result = beforeSection + '\n' + bullet + content.slice(sectionEnd);
```

When appending before the next heading (nextHeading !== -1), `sectionEnd` points to the `\n` before `## NextSection`. After trimming and reconstructing:
```
<See Also content>\n<new bullet>\n## NextSection
```
This is missing a blank line — the heading should be preceded by `\n\n`, not `\n`.

In Markdown, a heading must be separated from preceding content by a blank line. With only one newline, some parsers treat the heading as a paragraph continuation.

**Fix:**
Ensure blank line before next heading:
```typescript
const beforeSection = content.slice(0, sectionEnd).trimEnd();
const restOfContent = content.slice(sectionEnd);
// Always ensure blank line before next heading
const separator = restOfContent.startsWith('\n##') ? '\n' : '\n\n';
const result = beforeSection + '\n' + bullet + separator + restOfContent;
```

Or simplify:
```typescript
const result = beforeSection + '\n' + bullet + '\n' + content.slice(sectionEnd);
```

---

### 6. CRITICAL: quoteYamlString unconditionally quotes all scalars — breaks boolean and numeric types

**File:** `crossref-agent/workflows/crossref.ts`, line 64 (and `metadata-extractor.ts` line 116)  
**Severity:** Important — breaks downstream tooling (Docusaurus, MDX)  
**Impact:** Sidebar ordering broken, boolean flags ignored

**Problem:**
```typescript
function quoteYamlString(value: string): string {
  if (!value) return '""';
  if (value.includes('\n') || ...) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `"${value}"`;  // <-- unconditional quotes
}

// Usage:
return `${k}: ${quoteYamlString(String(v))}`;
```

All scalar values are wrapped in double quotes:
- `sidebar_position: 2` becomes `sidebar_position: "2"` (breaks numeric ordering)
- `draft: false` becomes `draft: "false"` (read as string, not boolean)
- `slug: hello` becomes `slug: "hello"` (valid but unnecessary)

**Fix:**
Distinguish YAML types:
```typescript
function serializeYamlValue(value: any): string {
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return 'null';
  
  // String: quote only if needed
  if (typeof value === 'string') {
    if (!value || /[:\n"'#[\]{}@`]/.test(value)) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  
  return `"${String(value)}"`;
}

// Usage:
return `${k}: ${serializeYamlValue(v)}`;
```

Apply to both `updateFrontmatter` (metadata-extractor.ts) and `updateFrontmatterLocal` (workflows/crossref.ts).

---

### 7. CRITICAL: validateSuggestion and insertInlineLink diverge on anchor-finding logic

**File:** `link-validator.ts` line 24 vs `link-inserter.ts` line 31  
**Severity:** Important — silent failure: validated anchors can fail to insert  
**Impact:** Operators unaware of validation/insertion divergence

**Problem:**
- `validateSuggestion()` checks: (1) target file exists, (2) not already linked. It does NOT verify anchor exists.
- `insertInlineLink()` applies 5 fuzzy strategies (exact, no-articles, keywords, inline-code, etc.)
- If anchor is not found via fuzzy match, insertion silently fails with `{ inserted: false, reason: 'no_safe_match' }`

**Failure scenario:**
1. Agent suggests link with anchor "the ZIO Runtime"
2. Validation passes (file exists, not linked)
3. Insertion tries 5 strategies, all fail (text not in document)
4. Suggestion marked `skipped` with no log distinguishing "validation rejected" from "validation passed, insertion failed"
5. Operator sees only skip count, not failure reason

**Fix:**
Add anchor-existence check to validation:
```typescript
export function validateSuggestion(
  suggestion: LinkSuggestion,
  state: CrossrefState
): { ok: boolean; reason?: string } {
  const target = state.index.find(e => e.id === suggestion.targetId);
  if (!target) return { ok: false, reason: 'target_not_in_index' };
  if (suggestion.alreadyLinked) return { ok: false, reason: 'already_linked' };
  
  // NEW: Check if anchor exists in source document
  if (suggestion.type === 'inline') {
    const content = fs.readFileSync(target.absPath, 'utf-8');
    const match = findAnchorWithFallback(content, suggestion.anchorText);
    if (!match) {
      return { ok: false, reason: 'anchor_not_in_source' };
    }
  }
  
  // Check if anchor exists in target
  if (suggestion.type === 'inline' && suggestion.anchorText.includes('.')) {
    if (!hasAnchorInTarget(target, suggestion.anchorText)) {
      return { ok: false, reason: 'anchor_not_in_target' };
    }
  }
  
  return { ok: true };
}
```

And log the failure reason:
```typescript
const validation = validateSuggestion(suggestion, state);
if (!validation.ok) {
  suggestion.status = 'skipped';
  suggestion.validationReason = validation.reason;
  console.log(`[skip] ${suggestion.sourceId} → ${suggestion.targetId}: ${validation.reason}`);
}
```

---

### 8. CRITICAL: computeSafeZones() does not mark inline code spans — links injected inside backticks

**File:** `crossref-agent/tools/markdown-parser.ts`, line 77–98  
**Severity:** Important — violates semantic intent of safe zones  
**Impact:** Markdown syntax validity depends on renderer; some fail

**Problem:**
```typescript
function computeSafeZones(content: string): SafeZone[] {
  const zones: SafeZone[] = [];
  
  // Frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) zones.push({ start: 0, end: fmMatch[0].length });
  
  // Code fences
  const fenceRegex = /(```|~~~)[\s\S]*?\1/g;
  // ... match and push zones ...
  
  // MISSING: Inline code spans
  // const inlineCodeRegex = /`[^`\n]+`/g;
}
```

Inline code is not protected. `insertInlineLink` has strategies to match inline code but does not check safe zones. Result:
- Text inside backticks can be matched and linked
- Output: `` [`term`](path) `` — syntactically valid but semantically wrong

**Fix:**
Add inline code detection:
```typescript
export function computeSafeZones(content: string): SafeZone[] {
  const zones: SafeZone[] = [];
  
  // Frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (fmMatch) zones.push({ start: 0, end: fmMatch[0].length });
  
  // Fenced code blocks
  const fenceRegex = /(```|~~~)[\s\S]*?\1/g;
  let match;
  while ((match = fenceRegex.exec(content)) !== null) {
    zones.push({ start: match.index, end: match.index + match[0].length });
  }
  
  // Indented code blocks (4-space or tab-indented lines)
  const lines = content.split('\n');
  let inIndentedBlock = false;
  let blockStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isIndented = /^(    |\t)/.test(line) && line.trim().length > 0;
    if (isIndented && !inIndentedBlock) {
      inIndentedBlock = true;
      blockStart = content.indexOf(line);
    } else if (!isIndented && inIndentedBlock) {
      inIndentedBlock = false;
      const blockEnd = content.lastIndexOf('\n', content.indexOf(line));
      zones.push({ start: blockStart, end: blockEnd });
    }
  }
  
  // Inline code spans
  const inlineCodeRegex = /`[^`\n]+`/g;
  while ((match = inlineCodeRegex.exec(content)) !== null) {
    zones.push({ start: match.index, end: match.index + match[0].length });
  }
  
  return zones;
}
```

Then remove inline-code fallback strategies from `findAnchorWithFallback` in link-inserter.ts (lines 70–83), since plain text matching will find the term outside safe zones if it exists there.

---

## Implementation Order

1. **Fix parsing (Finding #1)** → enables all downstream fixes
   - Replace `parseFrontmatter` regex with YAML parser
   - Update return type to support arrays
   
2. **Fix state serialization (Finding #2)** → enables metadata persistence
   - Add description/keywords to saveState/loadState
   
3. **Fix session reentrancy (Finding #3)** → enables safe autopilot
   - Move metadata extraction before agent loop OR use separate session
   
4. **Fix reindex progress loss (Finding #4)** → enables restartable autopilot
   - Preserve `processed` list across reindex
   
5. **Fix safe zones (Finding #8)** → enables correct link insertion
   - Add inline code, indented code to computeSafeZones
   
6. **Fix See Also spacing (Finding #5)** → enables valid markdown
   - Ensure blank line before next heading
   
7. **Fix YAML quoting (Finding #6)** → enables correct type handling
   - Distinguish numeric, boolean, string types in serialization
   
8. **Fix validation divergence (Finding #7)** → enables clear error reporting
   - Add anchor-presence check to validateSuggestion
   - Log validation reason

---

## Testing After Fixes

- [ ] Parse YAML with array fields; verify round-trip preservation
- [ ] Autopilot 50+ pages; verify metadata persists across reloads
- [ ] Run metadata extraction + agent in sequence; no deadlock
- [ ] Reindex mid-autopilot; verify processed count preserved
- [ ] See Also with next heading; verify blank line before heading
- [ ] Frontmatter with `sidebar_position: 2, draft: false`; verify types
- [ ] Invalid anchor suggestion; verify logged as `anchor_not_in_source`
- [ ] Inline code with fuzzy-match term; verify not linked (safe zone protects)

---

## Success Criteria

✅ parseFrontmatter correctly reads/writes YAML arrays  
✅ State.index entries with description/keywords survive reload  
✅ Session.prompt() calls never deadlock (sequential or separate session)  
✅ Autopilot reindex does not lose processed pages  
✅ See Also entries properly spaced before next section  
✅ Non-string YAML fields (boolean, numeric) preserve type  
✅ Validation failures logged with clear reason  
✅ Inline code and indented code blocks never receive links  

