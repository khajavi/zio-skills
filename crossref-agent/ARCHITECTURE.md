# Crossref Agent Architecture

**Comprehensive guide to understanding how the crossref-agent discovers, suggests, validates, and applies cross-references in documentation.**

Generated: 2026-06-05  
Last Updated: Per code review at commit HEAD

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Principles](#core-principles)
3. [Component Architecture](#component-architecture)
4. [Data Flow](#data-flow)
5. [Execution Modes](#execution-modes)
6. [Decision Trees](#decision-trees)
7. [State Management](#state-management)
8. [Complete Example Trace](#complete-example-trace)
9. [Security Model](#security-model)
10. [Extension Points](#extension-points)

---

## System Overview

The **crossref-agent** is a Flue-based TypeScript system that automatically discovers and creates cross-references between pages in Markdown documentation. It operates in four distinct phases:

```
┌─────────────────────────────────────────────────────────────────┐
│                    CROSSREF AGENT SYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input: /docs (Markdown files)                                 │
│    ↓                                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PHASE 1: REINDEX                                        │  │
│  │ - Walk documentation tree                               │  │
│  │ - Extract: title, summary, keywords, adjacency info    │  │
│  │ - Build searchable page index                          │  │
│  │ → Output: state.index (all pages metadata)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│    ↓                                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PHASE 2: SUGGESTION GENERATION                         │  │
│  │ - For each unprocessed page:                           │  │
│  │   - Load content from disk                             │  │
│  │   - Build context: index, adjacent pages, metadata    │  │
│  │   - Invoke Claude agent (page-linker)                 │  │
│  │   - Parse JSON suggestions from LLM                    │  │
│  │ → Output: raw suggestions from LLM                     │  │
│  └─────────────────────────────────────────────────────────┘  │
│    ↓                                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PHASE 3: ENRICHMENT & DEDUPLICATION                    │  │
│  │ - Compute relative paths for each suggestion           │  │
│  │ - Check against accumulated suggestions                │  │
│  │ - Avoid re-adding duplicates                           │  │
│  │ - Accumulate to state.suggestions                      │  │
│  │ → Output: state.suggestions (deduplicated)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│    ↓                                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ PHASE 4: VALIDATION & APPLICATION                      │  │
│  │ - For each high-confidence suggestion:                 │  │
│  │   - Validate: path safety, existence, no duplicates   │  │
│  │   - Insert link into page content                      │  │
│  │   - Write updated content to disk                      │  │
│  │   - Mark as "applied" or "skipped"                     │  │
│  │ → Output: Updated .md/.mdx files on disk              │  │
│  └─────────────────────────────────────────────────────────┘  │
│    ↓                                                            │
│  Output: Cross-linked documentation, persistent state          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

### 1. **Safety Over Automation**
- All link insertions validated before writing to disk
- Code blocks and frontmatter protected (safe zones)
- Path traversal attacks prevented via `realpathSync`
- Symlinks resolved and verified

### 2. **Confidence-Driven**
- Suggestions have explicit confidence levels: `high`, `medium`, `low`
- Only high-confidence links auto-applied
- Medium/low queued for human review
- Confidence elevated when validation finds exact matches

### 3. **Persistent Incremental Processing**
- State accumulated in `.crossref-state/state.json`
- Pages marked as "processed" to avoid re-analysis
- Suggestions deduplicated to prevent duplicates
- Progress preserved across runs

### 4. **LLM-Assisted but Not LLM-Dependent**
- Claude agent generates suggestions, but:
  - Paths computed deterministically (never from LLM)
  - All anchor text validated via safe-zone search
  - Duplicates checked before storing
- LLM output treated as advisory, not authoritative

---

## Component Architecture

### High-Level Component Diagram

```
┌──────────────────────────────────┐
│    Workflow Entry Point          │
│  (workflows/crossref.ts)         │
├──────────────────────────────────┤
│ Routes to execution mode:        │
│ - reindex → Reindex phase        │
│ - step → ProcessBatch (single)   │
│ - autopilot → Loop step until OK │
│ - report → Analyze state         │
└─────────────┬────────────────────┘
              ↓
┌──────────────────────────────────────────────────────┐
│           Phase Orchestration                        │
├──────────────────────────────────────────────────────┤
│ • reindex.ts         → Build index from disk        │
│ • process.ts         → Generate & apply suggestions │
│ • report.ts          → Analyze coverage metrics     │
└─────────────┬────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────┐
│           Agent & Tools                             │
├──────────────────────────────────────────────────────┤
│ Agents:                                              │
│ • agents/page-linker.ts → Claude Haiku 4.5 agent  │
│   - Loads: cross-linker skill                       │
│   - Invoked per page                                │
│                                                      │
│ Tools (session.prompt):                             │
│ • validate_anchor                                   │
│ • extract_page_structure                           │
│ • get_adjacent_pages                               │
│ • search_pages                                      │
│ • search_page_content                              │
└──────────────┬───────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────┐
│           Pure Utility Functions                     │
├──────────────────────────────────────────────────────┤
│ • markdown-parser.ts     → Parse content, headings  │
│ • link-inserter.ts       → Insert links into prose  │
│ • link-validator.ts      → Safety & path checks    │
│ • sidebar-parser.ts      → Extract adjacent pages   │
│ • metadata-extractor.ts  → Extract page metadata    │
│ • page-search.ts         → Search index by term     │
│ • content-search.ts      → Search page content      │
│ • config-loader.ts       → Load .crossref-config.json │
│ • state-store.ts         → Persist/load state       │
└──────────────┬───────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────┐
│           External Systems                          │
├──────────────────────────────────────────────────────┤
│ • File system (Node.js fs)                          │
│ • Flue runtime & Claude API                         │
│ • Configuration (.crossref-config.json)             │
│ • Persistent state (.crossref-state/)               │
└──────────────────────────────────────────────────────┘
```

### Component Responsibilities

#### **Workflow: `workflows/crossref.ts`

Entry point that:
- Parses payload (docsDir, mode, batchSize, targetFile, targetDir)
- Initializes Flue session with page-linker agent
- Routes to appropriate phase based on mode
- Aggregates and reports results

**Key decisions:**
- If reindex: call reindex() → return indexed count
- If step/autopilot: verify index exists, then processBatch()
- If report: generate coverage analysis
- If unknown mode: throw error

#### **Reindex Phase: `workflows/phases/reindex.ts`

Discovers all documentation and builds the page index:

1. **Walk Documentation Tree**
   - Recursively find all `.md` and `.mdx` files
   - Respect excludePatterns from config
   - Skip unreadable directories with warnings

2. **Extract Metadata**
   - Title (from frontmatter or first heading)
   - Path (relative to docsDir)
   - Existing link count (for metrics)
   - Description & keywords (from frontmatter, may be empty)

3. **Load Adjacent Pages**
   - Parse `sidebars.js` (if exists)
   - Map each page to pages in same section
   - Used later for "See Also" suggestions

4. **Create IndexEntry Array**
   - Each entry: { id, title, path, absPath, description, keywords, adjacentPages }
   - Store in state.index
   - Reset state.processed = [] (all pages re-analyzable)

**Output:** `.crossref-state/state.json` with full index

#### **Process Phase: `workflows/phases/process.ts`

Generates and applies suggestions for pages:

1. **Batch Selection**
   - If targetFile: process exactly that file
   - Else if targetDir: process up to batchSize files in that directory
   - Else: process next unprocessed pages

2. **Metadata Extraction**
   - If page missing description OR keywords:
     - Call LLM to extract (sequential, not parallel)
     - Write updated frontmatter to disk
   - Purpose: ensure rich context for suggestion generation

3. **Build Prompt Context**
   - Minimal index (id, title, path) as JSON
   - Full page list for manual browsing
   - Adjacent pages list
   - Code block technical terms
   - Full page content

4. **Invoke Agent**
   - Call session.prompt() with cross-linker skill
   - Tools available: validate_anchor, search_pages, etc.
   - Returns schema-validated PageAnalysisOutput
   - On failure: mark page as processed, continue

5. **Suggestion Enrichment**
   - For each suggestion from agent:
     - Look up target in index
     - Compute relative path (deterministic)
     - Check if already in state.suggestions (deduplication)
     - Add to newSuggestions array

6. **Apply High-Confidence Links**
   - For each high-confidence suggestion:
     - Validate: path exists, no duplicates, anchor safe
     - Insert link into page content (using safe zones)
     - If successful: mark as "applied", write to disk
     - If failed: mark as "skipped"
   - Track applied/queued counts

7. **State Persistence**
   - Save state.json after each page
   - Increment processed[] array
   - Accumulate token usage
   - Update suggestion status (applied/skipped/pending)

**Output:** Updated .md/.mdx files, persisted state

#### **Report Phase: `workflows/phases/report.ts`

Analyzes coverage metrics:
- Total pages vs. processed
- Suggestions breakdown (applied/skipped/pending)
- Link density by section type
- Orphaned pages (no incoming links)
- Token spend and cost

---

## Data Flow

### State Object Structure

```typescript
interface CrossrefState {
  indexBuiltAt: string;              // When index was last built
  docsDir: string;                   // Path to docs directory
  
  index: PageIndexEntry[];           // All pages in docs
  // [
  //   {
  //     id: "reference/fiber/fiber",
  //     title: "Fiber",
  //     path: "reference/fiber/fiber.md",
  //     absPath: "/full/path/to/fiber.md",
  //     description: "A lightweight...",
  //     keywords: ["concurrency", "async"],
  //     existingLinkCount: 3,
  //     adjacentPages: ["reference/fiber/scheduler", "reference/fiber/local"]
  //   }
  // ]
  
  processed: string[];               // Page IDs already analyzed
  // ["getting-started", "reference/fiber/fiber"]
  
  suggestions: LinkSuggestion[];      // Accumulated suggestions
  // [
  //   {
  //     sourceId: "reference/fiber/fiber",
  //     targetId: "concepts/concurrency",
  //     targetTitle: "Concurrency",
  //     targetRelativePath: "../../concepts/concurrency.md",
  //     anchorText: "concurrent",
  //     type: "inline",
  //     confidence: "high",
  //     reasoning: "Title mentioned in prose",
  //     status: "applied"
  //   }
  // ]
  
  tokens: {
    inputTotal: number;              // Total input tokens used
    outputTotal: number;             // Total output tokens used
    runningCost: number;             // Estimated cost in USD
  }
}
```

### Data Flow by Mode

#### **Mode: reindex**

```
Payload: { docsDir, mode: "reindex" }
  ↓
Load existing state (or create empty)
  ↓
walkDocs(docsDir, excludePatterns)
  → Recursively find .md/.mdx files
  ↓
For each file:
  - Read content
  - Extract title, path, existing links
  - Parse frontmatter (description, keywords)
  ↓
Load adjacent pages from sidebars.js
  ↓
Create index array
  ↓
Reset processed = [] (all pages available for analysis)
  ↓
Save state.json
  ↓
Return: { indexed: state.index.length }
```

#### **Mode: step**

```
Payload: { docsDir, mode: "step", batchSize?, targetFile?, targetDir? }
  ↓
Load state (require index.length > 0)
  ↓
Determine batch:
  If targetFile → Find & load that entry
  Else if targetDir → Find all files in dir, take batchSize
  Else → Find unprocessed pages, take batchSize
  ↓
For each page in batch:
  │
  ├─ Load content from disk
  │
  ├─ Extract metadata (if missing description/keywords)
  │   ├─ Call LLM: "extract metadata"
  │   └─ Write updated frontmatter to file
  │
  ├─ Build prompt:
  │   - Minimal index (JSON)
  │   - Page list
  │   - Adjacent pages
  │   - Code block terms
  │   - Full page content
  │
  ├─ Call session.prompt() with cross-linker skill
  │   ├─ Tools: validate_anchor, search_pages, etc.
  │   └─ Returns: PageAnalysisOutput (schema-validated)
  │
  ├─ For each suggestion from output:
  │   ├─ Look up target in index
  │   ├─ Compute relative path
  │   ├─ Check deduplication
  │   └─ Add to state.suggestions
  │
  ├─ For each high-confidence suggestion:
  │   ├─ Validate: path safe, not duplicate, anchor found
  │   ├─ Insert into page content (safe zones)
  │   ├─ Write to disk if inserted
  │   └─ Mark as applied/skipped
  │
  └─ Save state.json
  ↓
Return: { done, processed, remaining }
```

#### **Mode: autopilot**

```
Loop {
  result = processBatch(...) // Same as step mode
  totalProcessed += result.processed
  if (result.done) break
  reload state.json
}
Return: { done: true, totalProcessed }
```

#### **Mode: report**

```
Load state (require index.length > 0)
  ↓
Compute metrics:
  - Coverage: processed / total
  - Suggestions: applied / skipped / pending counts
  - Link density: avg outgoing links per page
  - Orphans: pages with no incoming links
  - Tokens: total spend + estimated cost
  ↓
Print formatted report
  ↓
Return: metrics object
```

---

## Execution Modes

### Mode 1: `reindex`

**Purpose:** Build or rebuild the page index from scratch

**When to use:**
- First time setting up agent
- After major documentation restructuring
- To reset and re-analyze all pages

**Command:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"reindex"}'
```

**Process:**
1. Walk docs directory
2. Extract title, path, metadata for each page
3. Load adjacent page info from sidebars.js
4. Create comprehensive index
5. Reset processed array (all pages available)
6. Save to `.crossref-state/state.json`

**Output:**
- `.crossref-state/state.json` with full index
- Console: "Index built: 293 pages"
- No files modified

---

### Mode 2: `step`

**Purpose:** Process one batch of pages incrementally

**When to use:**
- Incremental processing
- Manual control over page-by-page analysis
- Testing on specific files
- Batch processing with reviews

**Variants:**

**2a. Process next unprocessed page:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"step","batchSize":1}'
```

**2b. Process specific file:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"step","targetFile":"reference/fiber.md"}'
```

**2c. Process directory:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"step","targetDir":"reference/","batchSize":5}'
```

**Process:**
1. Load state
2. Select batch based on parameters
3. For each page:
   - Extract metadata if missing
   - Invoke agent with full context
   - Enrich and deduplicate suggestions
   - Apply high-confidence links
   - Save state
4. Return results

**Output:**
- Updated .md/.mdx files (for applied links)
- `.crossref-state/state.json` (updated state)
- Console: per-page progress with link counts and token usage

---

### Mode 3: `autopilot`

**Purpose:** Process all remaining pages without manual intervention

**When to use:**
- Complete documentation coverage
- Overnight runs
- Production deployments

**Command:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"autopilot"}'
```

**Process:**
1. Load state
2. Loop {
   - Call processBatch(...) with default batchSize
   - Break if done (all pages processed)
   - Reload state between batches
3. Print final summary

**Output:**
- All unprocessed pages analyzed
- Links applied to files
- Final console: "Autopilot complete. Total processed: X/Y"

---

### Mode 4: `report`

**Purpose:** Analyze coverage metrics without modifying files

**When to use:**
- Check progress
- Identify orphaned pages
- Measure link density
- Verify cost estimates

**Command:**
```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"report"}'
```

**Output:**
```
Coverage:  293 total | 45 processed (15%) | 248 pending
Suggestions:
  - Applied: 32 (high: 32)
  - Skipped: 18 (validation failed)
  - Pending: 44 (medium: 30, low: 14)
Link Density:
  - Reference pages: avg 2.1 outgoing links
  - Guide pages: avg 1.8 outgoing links
Orphans (no incoming links):
  - reference/old-api
  - guides/deprecated
Tokens: in: 150,000 | out: 50,000 | cost: ~$0.60
```

---

## Decision Trees

### Decision: Should This Page Be Processed?

```
Page in batch?
├─ YES: Continue to "Extract Metadata"
└─ NO: Skip to next page
```

### Decision: Extract Metadata?

```
Does page have description AND keywords in frontmatter?
├─ YES (both present): Skip metadata extraction
│   └─ Continue to "Generate Suggestions"
└─ NO (either missing):
    ├─ Call LLM: "Extract metadata from this page"
    ├─ Parse result: description + keywords array
    ├─ Update frontmatter + write to disk
    └─ Continue to "Generate Suggestions"
```

### Decision: Should This Suggestion Be Stored?

```
Suggestion from agent:
├─ Does target exist in index?
│  └─ NO: Skip (log "target not in index")
└─ YES:
    ├─ Compute relative path (deterministic)
    ├─ Already in state.suggestions?
    │  ├─ YES: Skip (log "already exists")
    │  └─ NO: Add to state.suggestions (pending)
    └─ Continue to "Validate & Apply"
```

### Decision: Should This Suggestion Be Applied?

```
Suggestion in state.suggestions:
├─ Meets confidence threshold?
│  └─ NO: Mark as "pending" (queued for review)
│  └─ YES:
│      ├─ Path safe? (no traversal, within docsDir)
│      │  └─ NO: Mark as "skipped" (validation failed)
│      │  └─ YES:
│      │      ├─ Is anchor text in safe zones? (not in code/frontmatter)
│      │      │  └─ NO: Mark as "skipped" (anchor not found)
│      │      │  └─ YES:
│      │      │      ├─ Try insert link
│      │      │      ├─ If successful: Mark as "applied"
│      │      │      │  └─ Write page to disk
│      │      │      └─ If failed: Mark as "skipped"
```

### Decision: What Confidence for This Link?

```
Start: confidence = agent's confidence (high/medium/low)

If medium-confidence INLINE link:
├─ Is anchor text found in page?
│  ├─ YES: Promote confidence to "high"
│  └─ NO: Keep as "medium"

If anchor text is method/operator (contains . or #):
├─ Does target page have that anchor/heading?
│  ├─ YES: Keep confidence
│  └─ NO: Demote or skip

Final confidence used to decide: auto-apply or queue for review
```

---

## State Management

### State Lifecycle

```
1. INITIALIZE
   ├─ loadState(docsDir) → existing state or emptyState()
   └─ state.json in .crossref-state/ directory

2. REINDEX
   ├─ state.index = [all pages from disk]
   ├─ state.processed = []
   └─ saveState(docsDir, state)

3. STEP/AUTOPILOT
   ├─ For each page:
   │  ├─ state.processed.push(pageId)
   │  ├─ state.suggestions.push(...newSuggestions)
   │  └─ saveState(docsDir, state)
   ├─ Links written to .md files (side effect)
   └─ state tracks which pages done, not file state

4. REPORT
   ├─ Read state (no modifications)
   ├─ Compute metrics from state
   └─ Print report
```

### State Persistence

**Location:** `.crossref-state/state.json`

**Save Points:**
- After reindex completes
- After processing each page in step mode
- Never saved in report mode

**Load Points:**
- At start of every execution
- Between batches in autopilot mode (to get latest state)

**Backup:**
- `.crossref-state/state.json.backup` created on each save
- Useful for recovery if state becomes corrupted

**Deduplication Mechanism:**
```typescript
// Before adding new suggestion:
const alreadyExists = state.suggestions.some(
  s => s.sourceId === pageId && s.targetId === targetId
);
if (alreadyExists) {
  // Skip (don't add duplicate)
} else {
  // Add to state.suggestions
}
```

### State Validation

All state is validated against Valibot schemas:
- `PageIndexEntry` – validates each page in index
- `LinkSuggestion` – validates each suggestion
- `CrossrefState` – validates entire state object

On load failure: attempts to load backup, or starts fresh

---

## Complete Example Trace

### Scenario: Process `reference/concurrency/promise.md`

#### Setup
```
Payload: {
  docsDir: "/home/milad/sources/scala/zio-2.x-new/docs",
  mode: "step",
  targetFile: "reference/concurrency/promise.md",
  batchSize: 1
}
```

#### Trace Execution

**Step 1: Entry (workflows/crossref.ts)**
```
1. Parse payload
   - docsDir = "/home/milad/sources/scala/zio-2.x-new/docs"
   - mode = "step"
   - targetFile = "reference/concurrency/promise.md"

2. Initialize Flue session with page-linker agent
   - Agent model: claude-haiku-4-5
   - Skills: cross-linker

3. Call processBatch(state, config, session, ...)
```

**Step 2: Load & Validate State (process.ts)**
```
1. loadState(docsDir)
   - Load .crossref-state/state.json
   - Validate against CrossrefState schema
   - Result: state object with 293 pages in index

2. Check: state.index.length > 0?
   - YES (293 pages)
   - Continue

3. Determine batch:
   - targetFile = "reference/concurrency/promise.md"
   - Normalize to absolute path
   - realpathSync check (symlink safety)
   - Find entry in state.index matching path
   - Result: batch = [pageEntry for promise.md]
```

**Step 3: Load Page Content (process.ts)**
```
1. pageEntry.absPath = "/home/milad/sources/scala/zio-2.x-new/docs/reference/concurrency/promise.md"

2. fs.readFileSync(absPath)
   - Returns full markdown content
   
3. parseFrontmatter(content)
   - Extract YAML frontmatter
   - Result: { title: "Promise", description: "...", keywords: [...] }

4. Check: Has both description and keywords?
   - YES (both present in frontmatter)
   - Skip metadata extraction
   - Continue
```

**Step 4: Build LLM Prompt (process.ts)**
```
1. Create minimalIndex (JSON):
   [
     { id: "reference/concurrency/fiber", title: "Fiber", path: "reference/concurrency/fiber.md" },
     { id: "reference/concurrency/promise", title: "Promise", path: "reference/concurrency/promise.md" },
     ...
   ]

2. Create pageList (text):
   "reference__concurrency__fiber — Fiber
    reference__concurrency__promise — Promise
    ..."

3. adjacentPagesInfo from promise entry:
   "Adjacent pages (same documentation section): 
    reference__concurrency__fiber, 
    reference__concurrency__async-test"

4. extractCodeBlockIdentifiers(content):
   - Scan code fences (```...```)
   - Find identifiers: ["Promise.make", "Promise.complete", "ZIO.fromFuture"]
   
5. codeBlockContext:
   "Technical terms found in code blocks: 
    Promise.make, Promise.complete, ZIO.fromFuture"

6. Final prompt:
   """
   Analyze the page content below for cross-link opportunities.
   Config: maxLinksPerPage=5, maxSeeAlsoSuggestion=5
   
   Page index (all available pages):
   [pageList]
   
   Structured index (JSON):
   [minimalIndex]
   
   Adjacent pages (same documentation section):
   reference__concurrency__fiber, reference__concurrency__async-test
   
   Technical terms found in code blocks:
   Promise.make, Promise.complete, ZIO.fromFuture
   
   When generating See Also suggestions:
   - Use code block technical terms to identify related pages
   - Example: If code shows ZIO.acquireRelease, suggest resource management pages
   - Prefer pages that document these code concepts
   
   Page being analyzed (id: reference__concurrency__promise):
   [full page content]
   """
```

**Step 5: Invoke Agent (process.ts)**
```
1. session.prompt(prompt, {
     result: PageAnalysisOutput,  // Schema validation
     tools: [                     // Available to agent
       validate_anchor,
       extract_page_structure,
       get_adjacent_pages,
       search_pages,
       search_page_content
     ]
   })

2. Agent receives prompt + tools

3. Agent reasoning (Claude Haiku 4.5 with cross-linker skill):
   a. Read page title: "Promise"
   b. Read key concepts: "complete, resolve, make"
   c. Scan prose:
      - Mentions "Fiber" → might link
      - Mentions "ZIO" → adjacent concepts
      - Mentions "concurrent" → general topic
   d. Check adjacent pages:
      - reference__concurrency__fiber (YES, same section)
      - reference__concurrency__async-test (YES, same section)
   e. Generate suggestions:
      - Fiber (inline, high) – "Promise wraps Fiber, mentioned in intro"
      - Async (See Also, high) – "Testing async operations"
      - ZIO Core (See Also, medium) – "ZIO.fromFuture used in example"
   f. Return JSON:
      {
        "suggestions": [
          {
            "targetId": "reference__concurrency__fiber",
            "targetTitle": "Fiber",
            "anchorText": "Fiber",
            "type": "inline",
            "confidence": "high",
            "reasoning": "Central concept, mentioned in intro"
          },
          {
            "targetId": "reference__concurrency__async-test",
            "targetTitle": "Async Test",
            "anchorText": "async testing",
            "description": "Testing async operations",
            "type": "see_also",
            "confidence": "high",
            "reasoning": "Adjacent page, same section"
          },
          {
            "targetId": "concepts__zio__core",
            "targetTitle": "ZIO Core",
            "anchorText": "ZIO",
            "description": "Core concurrency primitives",
            "type": "see_also",
            "confidence": "medium",
            "reasoning": "ZIO.fromFuture used in code example"
          }
        ]
      }

4. Token usage tracked: input=66, output=4147
```

**Step 6: Enrich & Deduplicate (process.ts)**
```
1. For each suggestion from agent:

   Suggestion 1: target=reference__concurrency__fiber
   ├─ Look up in state.index → found
   ├─ Compute relative path:
   │  - pageEntry.absPath = "/docs/reference/concurrency/promise.md"
   │  - targetEntry.absPath = "/docs/reference/concurrency/fiber.md"
   │  - path.relative(dirname(promise), fiber) = "fiber.md"
   ├─ Check deduplication:
   │  - state.suggestions has (promise→fiber)?
   │  - NO (first time)
   ├─ Add to newSuggestions:
   │  {
   │    sourceId: "reference__concurrency__promise",
   │    targetId: "reference__concurrency__fiber",
   │    targetTitle: "Fiber",
   │    targetRelativePath: "fiber.md",
   │    anchorText: "Fiber",
   │    type: "inline",
   │    confidence: "high",
   │    reasoning: "Central concept...",
   │    status: "pending"
   │  }

   Suggestion 2: target=reference__concurrency__async-test
   ├─ [Same process]
   ├─ Add with status="pending"
   
   Suggestion 3: target=concepts__zio__core
   ├─ [Same process]
   ├─ Add with status="pending"

2. Push newSuggestions to state.suggestions
   - state.suggestions now has 3 new entries
```

**Step 7: Validate & Apply (process.ts)**
```
1. Get high-confidence suggestions for this page:
   - Suggestions 1 & 2 are HIGH confidence
   - Suggestion 3 is MEDIUM confidence (below threshold)

2. suggestionsToProcess = [Suggestion1, Suggestion2]

3. For Suggestion 1 (Fiber, inline, high):
   a. Validate:
      - Path safe? YES (fiber.md is sibling)
      - Anchor text found? 
        - search_page_content("Fiber") in promise.md
        - Result: "Fiber" appears at line 15 in prose (not heading)
      - Valid? YES
   
   b. Try insert:
      - insertInlineLink(content, "Fiber", "fiber.md", safeZones)
      - Find "Fiber" in safe zones
      - Replace with "[Fiber](fiber.md)"
      - Result: { inserted: true, result: updatedContent }
   
   c. Mark as "applied"
   d. Update currentContent with change

4. For Suggestion 2 (Async Test, See Also, high):
   a. Validate:
      - Path safe? YES
      - Description present? YES ("Testing async operations")
      - Valid? YES
   
   b. Try insert:
      - insertSeeAlsoEntry(content, "Async Test", "async-test.md", description, safeZones)
      - Append to end of page:
        "## See Also\n- [Async Test](async-test.md) — Testing async operations"
      - Result: { inserted: true, result: updatedContent }
   
   c. Mark as "applied"
   d. Update currentContent with change

5. currentContent now has 2 links inserted

6. Write to disk:
   fs.writeFileSync(promise.md, currentContent)
```

**Step 8: Update State (process.ts)**
```
1. Update suggestion statuses:
   - suggestion 1: status = "applied"
   - suggestion 2: status = "applied"
   - suggestion 3: status = "pending" (didn't meet threshold)

2. Mark page as processed:
   state.processed.push("reference__concurrency__promise")

3. Update token counts:
   state.tokens.inputTotal += 66
   state.tokens.outputTotal += 4147
   state.tokens.runningCost = estimateCost(...)  // ~$0.020

4. Save state:
   saveState(docsDir, state)
   - Writes .crossref-state/state.json
   - Also creates .crossref-state/state.json.backup
```

**Step 9: Print Summary (report.ts)**
```
✓ Processed: Promise (25/293)
  Applied: 2 links  |  Queued: 1
  Tokens this run — in: 66  out: 4,147
  Tokens total    — in: 1,088  out: 256,543  (~$1.03)
```

**Step 10: Return Result**
```
{
  done: false,              // 268 pages still unprocessed
  processed: 1,             // This batch
  remaining: 268            // Unprocessed pages
}
```

---

## Security Model

### Path Traversal Protection

**Threat:** Malicious paths in suggestions could escape docsDir

**Defense:**
```typescript
// 1. All absolute paths resolved via realpathSync
const realDocsDir = fs.realpathSync(docsDir);
const realTarget = fs.realpathSync(targetPath);

// 2. Verify resolved path is within docsDir
if (!realTarget.startsWith(realDocsDir + path.sep)) {
  throw new Error("Path outside docsDir");
}

// 3. Relative paths computed deterministically (never from LLM)
const relPath = path.relative(dirname(source), target);
// LLM only provides IDs; system looks up files
```

### Safe Zones Protection

**Threat:** Links inserted into code blocks, frontmatter, or inline code

**Defense:**
```typescript
// Compute safe zones:
// - Skip frontmatter (--- ... ---)
// - Skip code fences (``` ... ```, ~~~ ... ~~~)
// - Skip inline code (` ... `)
const safeZones = computeSafeZones(content, {
  includeInlineCode: false  // Don't insert into backticks
});

// Anchor text must be in safe zones:
const inSafeZone = safeZones.every(zone => {
  return matchPosition < zone.start || matchPosition > zone.end;
});
```

### LLM Output Validation

**Threat:** Claude generates invalid JSON or malicious suggestions

**Defense:**
```typescript
// 1. Schema validation via Valibot
const output = await session.prompt(prompt, {
  result: PageAnalysisOutput  // Enforced schema
});

// 2. Target ID checked against index
if (!state.index.find(e => e.id === suggestion.targetId)) {
  // Skip suggestion
}

// 3. Relative paths never from LLM (always computed)
const relPath = path.relative(...);  // Deterministic, safe
```

### Symlink Resolution

**Threat:** Symlinks could be exploited to escape docsDir

**Defense:**
```typescript
// Resolve all symlinks to real target
const realPath = fs.realpathSync(somePath);

// Then verify real path is within boundary
if (!realPath.startsWith(realDocsDir + path.sep)) {
  throw new Error("Symlink target outside docsDir");
}
```

---

## Extension Points

### 1. Custom Section Types

Currently: `reference`, `guide`, `tutorial`, `overview`, `other`

**To add new section type:**

```typescript
// In tools/schemas.ts
export const SectionType = v.picklist([
  'reference',
  'guide',
  'tutorial',
  'overview',
  'api-reference',  // ← new
  'troubleshooting', // ← new
  'other'
]);
```

Then configure confidence rules in process.ts or skill.

### 2. Custom Link Types

Currently: `inline`, `see_also`

**To add "related reading":**

```typescript
// In tools/schemas.ts
type: v.picklist(['inline', 'see_also', 'related']),

// In tools/link-inserter.ts
if (suggestion.type === 'related') {
  return insertRelatedLink(content, ...);
}
```

### 3. Custom Confidence Scoring

Currently: agent returns `high` / `medium` / `low`

**To override confidence:**

```typescript
// In workflows/phases/process.ts
if (suggestion.type === 'inline' && isFirstMention(content, anchor)) {
  suggestion.confidence = 'high';
}
```

### 4. Configuration Options

**Available in `.crossref-config.json`:**

```json
{
  "excludePatterns": ["node_modules", "archived"],
  "maxLinksPerPage": 5,
  "maxSeeAlsoSuggestion": 5,
  "confidenceThreshold": "high",
  "clearSuggestionsBeforeRun": false
}
```

**To add new option:**
1. Add to `CrossrefConfig` schema in schemas.ts
2. Load via `loadConfig(docsDir)` in desired phase
3. Pass to tools/LLM as context

### 5. Custom Tools

Currently available to agent:
- `validate_anchor`
- `extract_page_structure`
- `get_adjacent_pages`
- `search_pages`
- `search_page_content`

**To add custom tool:**

```typescript
// In tools/metadata-extractor.ts
export function createCustomSearchTool(state: CrossrefState) {
  return {
    name: 'my_custom_search',
    description: 'Search docs by custom criteria',
    inputSchema: v.object({ query: v.string() }),
    handler: (input) => {
      // Search logic
      return results;
    }
  };
}

// In workflows/phases/process.ts
const tools = [
  // ... existing tools
  createCustomSearchTool(state),  // ← add here
];
```

### 6. Custom Anchor Text Validation

Currently: Validates exact phrase match in safe zones

**To enhance validation:**

```typescript
// In tools/link-inserter.ts
function findAnchorWithFallback(
  content: string,
  anchorText: string,
  attempt: number,
  safeZones: SafeZone[]
): Match | null {
  // Current: exact match
  
  // Add: case-insensitive match
  // Add: partial word match
  // Add: synonym matching
}
```

### 7. Integration with Documentation Platforms

**Docusaurus support:**
```typescript
// Parse docusaurus config
const config = require('./docusaurus.config.js');
const docsDir = config.presets[0][1].docs.path;
```

**MkDocs support:**
```typescript
// Parse mkdocs.yml
const docs = yaml.load(fs.readFileSync('mkdocs.yml'));
const docsDir = docs.docs_dir;
```

### 8. Analytics & Reporting

Currently: Basic coverage metrics

**To add:**
- Link insertion success rate by file type
- Most-linked pages
- Pages with low incoming link count
- Performance metrics (tokens per page, cost trends)
- Export to CSV/JSON for analytics

---

## Summary: Decision Flow Diagram

```
START: Payload arrives
  ↓
[Mode: reindex?]
  ├─ YES → reindex() → Save index → END
  └─ NO ↓
[Mode: step?]
  ├─ YES ↓
  │  [Select batch]
  │    ├─ targetFile? → Use that file
  │    ├─ targetDir? → Use files in dir
  │    └─ else → Use next unprocessed
  │  ↓
  │  [For each page in batch]
  │    ├─ Load content
  │    ├─ Extract metadata if missing
  │    ├─ Invoke agent
  │    ├─ Enrich suggestions
  │    ├─ Validate & apply high-confidence
  │    └─ Save state
  │  ↓
  │  END: Return done/processed/remaining
  └─ NO ↓
[Mode: autopilot?]
  ├─ YES → Loop step until done → END
  └─ NO ↓
[Mode: report?]
  ├─ YES → Compute metrics → Print → END
  └─ NO → Error: Unknown mode
```

---

## Files Map

```
crossref-agent/
├── agents/
│   └── page-linker.ts             ← Claude agent definition
├── workflows/
│   ├── crossref.ts                ← Entry point, mode routing
│   ├── phases/
│   │   ├── reindex.ts             ← Phase 1: Index building
│   │   ├── process.ts             ← Phase 2-4: Suggest/validate/apply
│   │   └── report.ts              ← Phase 4: Coverage analysis
│   └── utils/
│       ├── confidence.ts          ← Threshold matching
│       ├── cost.ts                ← Token cost estimation
│       └── yaml.ts                ← Frontmatter updating
├── tools/
│   ├── schemas.ts                 ← Valibot schemas (validation)
│   ├── markdown-parser.ts         ← Parse frontmatter, headings, links
│   ├── link-inserter.ts           ← Insert inline/see-also links
│   ├── link-validator.ts          ← Validate paths, check duplicates
│   ├── metadata-extractor.ts      ← Tools for agent (validate_anchor, etc)
│   ├── page-search.ts             ← Tool: search_pages
│   ├── content-search.ts          ← Tool: search_page_content
│   ├── sidebar-parser.ts          ← Parse sidebars.js for adjacent pages
│   ├── config-loader.ts           ← Load .crossref-config.json
│   ├── state-store.ts             ← Load/save state.json
│   └── docs-fs.ts                 ← Async I/O tools
├── skills/
│   └── cross-linker/
│       └── SKILL.md               ← LLM instructions for agent
├── tests/
│   ├── markdown-parser.test.ts
│   ├── link-inserter.test.ts
│   ├── link-validator.test.ts
│   └── workflow-smoke.test.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

**End of Architecture Document**

This document provides a complete mental model of how the crossref-agent works, from high-level flow to detailed decision logic and security considerations.
