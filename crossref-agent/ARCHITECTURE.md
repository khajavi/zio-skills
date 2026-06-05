# Architecture Overview

This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

Crossref Agent is a TypeScript-based documentation cross-reference assistant built on the Flue framework. It analyzes Markdown documentation to discover and insert cross-linking opportunities while maintaining code safety and confidence-based validation.

```
crossref-agent/
├── agents/
│   └── page-linker.ts              # Flue agent profile (Claude Haiku 4.5)
│
├── tools/
│   ├── search_pages.ts             # Query index by title/keywords/topic
│   ├── search_page_content.ts       # Find terms and anchors in page prose
│   ├── validate_anchor.ts           # Check if heading/anchor exists
│   ├── extract_page_structure.ts    # Get full TOC and heading structure
│   └── get_adjacent_pages.ts        # Fetch pages in same directory
│
├── lib/
│   ├── schemas.ts                   # Valibot data structures (SectionType, PageIndexEntry, LinkSuggestion, etc.)
│   ├── state-store.ts               # Load/save index and suggestions JSON
│   ├── config-loader.ts             # Parse .crossref-config.json
│   ├── markdown-parser.ts           # Frontmatter, headings, safe zones (code blocks, inline code)
│   ├── title-utils.ts               # Title normalization
│   ├── migrate-state.ts             # State format migration for backwards compatibility
│   └── migrate-state.test.ts        # Migration tests
│
├── workflows/
│   ├── crossref.ts                  # Main entry point (4 modes: reindex, step, autopilot, report)
│   │
│   ├── phases/
│   │   ├── reindex.ts               # Mode: Build fresh index + LLM classification
│   │   ├── process.ts               # Mode: Process pages, generate suggestions, apply links
│   │   └── report.ts                # Mode: Coverage analysis, statistics
│   │
│   └── utils/
│       ├── link-inserter.ts         # Insert inline links or See Also sections
│       ├── link-validator.ts        # Validate path safety, no duplicates, anchor existence
│       ├── confidence.ts            # Check if suggestion meets threshold
│       ├── cost.ts                  # Estimate token cost (Claude pricing)
│       ├── metadata-utilities.ts    # Extract title, summary, keywords, section type
│       ├── sidebar-parser.ts        # Parse Docusaurus sidebars.js
│       └── yaml.ts                  # Frontmatter manipulation
│
├── skills/
│   └── cross-linker/
│       └── SKILL.md                 # LLM instructions for agent (cross-linking strategy)
│
├── tests/
│   ├── markdown-parser.test.ts      # 19 tests: frontmatter, headings, links, safe zones
│   ├── link-inserter.test.ts        # 11 tests: inline links, See Also, code-fence safety
│   ├── link-validator.test.ts       # 4 tests: paths, symlinks, duplicates
│   ├── migration.test.ts            # State format migration
│   └── workflow-smoke.test.ts       # 9 end-to-end tests with fixture docs
│
├── package.json                     # Deps: @flue/runtime, valibot, dotenv
├── tsconfig.json                    # TypeScript ES2022, NodeNext modules
├── vitest.config.ts                 # Test runner configuration
│
├── README.md                        # User-facing documentation
├── AGENTS.md                        # Agent configuration and payload guide
├── AGENT_RUNNING_GUIDE.md           # Detailed execution troubleshooting
└── ARCHITECTURE.md                  # This file
```

## 2. High-Level System Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│ Documentation Directory                                               │
│ ├── reference/fiber.md                                                │
│ ├── guides/getting-started.md                                         │
│ └── concepts/scope.md                                                 │
└──────────────────────┬────────────────────────────────────────────────┘
                       │
                       ↓
      ┌────────────────────────────────────┐
      │  WORKFLOW: crossref.ts             │
      │  Modes: reindex | step | autopilot │
      │         | report                   │
      └────────────────────────────────────┘
                       │
                ┌──────┴──────────┬─────────────┬──────────────┐
                │                 │             │              │
                ↓                 ↓             ↓              ↓
        ┌──────────────┐  ┌─────────────┐ ┌──────────┐ ┌──────────────┐
        │ REINDEX      │  │ STEP/AUTO   │ │ REPORT   │ │ STATE STORE  │
        │              │  │             │ │          │ │              │
        │ - Walk docs  │  │ - For each  │ │ - Show   │ │ - index.json │
        │ - Extract    │  │   page:     │ │   link   │ │ - suggestions│
        │   metadata   │  │   a. Load   │ │   density│ │   .json      │
        │ - LLM        │  │   b. Call   │ │ - Orphan │ │ - Persistent │
        │   classify   │  │      agent  │ │   pages  │ │              │
        │   sections   │  │   c. Parse  │ │          │ │              │
        │              │  │   d. Apply  │ │          │ │              │
        │              │  │   e. Save   │ │          │ │              │
        └──────────────┘  └─────────────┘ └──────────┘ └──────────────┘
                                 │
                                 ↓
                    ┌────────────────────────┐
                    │ AGENT: page-linker.ts  │
                    │ Model: Claude Haiku 4.5│
                    │                        │
                    │ Skill: cross-linker    │
                    │ (SKILL.md)             │
                    └──────────┬─────────────┘
                               │
                               ↓
                    ┌──────────────────────┐
                    │ TOOLS (Agent)        │
                    │                      │
                    │ - search_pages       │
                    │ - search_content     │
                    │ - validate_anchor    │
                    │ - extract_struct     │
                    │ - adjacent_pages     │
                    │ - extract_meta       │
                    └──────────────────────┘
                               │
                              ↓
                  ┌─────────────────────────┐
                  │ Suggestion JSON from    │
                  │ Agent (validated)       │
                  │                         │
                  │ { suggestions: [        │
                  │   { targetId,           │
                  │     anchorText,         │
                  │     type,               │
                  │     confidence }        │
                  │ ]}                      │
                  └─────────────────────────┘
                              │
                              ↓
                  ┌─────────────────────────┐
                  │ Validation + Insertion  │
                  │ (process.ts)            │
                  │                         │
                  │ - Check path safety     │
                  │ - Check duplicates      │
                  │ - Filter by confidence  │
                  │ - Insert links in file  │
                  └─────────────────────────┘
                              │
                              ↓
                  ┌─────────────────────────┐
                  │ Updated Markdown Files  │
                  │ + State Persistence     │
                  │                         │
                  │ .crossref-state/        │
                  │ ├── index.json          │
                  │ └── suggestions.json    │
                  └─────────────────────────┘
```

## 3. Core Components

### 3.1. Main Workflow Orchestrator

**Name:** Crossref Workflow (`workflows/crossref.ts`)

**Description:** Entry point for the agent system. Dispatches execution to four distinct modes based on `payload.mode`, managing state lifecycle and LLM session coordination.

**Technologies:** Flue Framework, TypeScript

**Key Responsibilities:**
- Load/initialize state from disk
- Route to correct phase (reindex, step, autopilot, report)
- Maintain LLM session across page batches
- Persist state after each operation

**Interface:**
```typescript
payload: {
  docsDir: string,           // Required: path to docs directory
  mode: 'reindex' | 'step' | 'autopilot' | 'report',
  batchSize?: number,        // Optional: pages per batch (default 1)
  targetFile?: string,       // Optional: specific file to process
  targetDir?: string         // Optional: process directory recursively
}
```

---

### 3.2. Agent

**Name:** Page Linker (`agents/page-linker.ts`)

**Description:** Flue-based agent powered by Claude Haiku 4.5. Receives a page's full content and documentation index, then reasons about cross-linking opportunities using the cross-linker skill.

**Technologies:** Anthropic API (Claude), Flue framework

**Capabilities:**
- Analyzes page content for cross-linking opportunities
- Uses tools to search index, validate anchors, extract metadata
- Returns structured JSON suggestions (inline links + See Also)
- Supports confidence levels (high/medium/low)

**Skill:** `skills/cross-linker/SKILL.md` — Detailed instructions on how to identify cross-references, select anchor text, and format suggestions.

---

### 3.3. Workflow Phases

#### 3.3.1. Reindex Phase (`workflows/phases/reindex.ts`)

**Purpose:** Build a fresh documentation index and classify all pages by section type.

**Process:**
1. Walk docs directory (respecting `excludePatterns`)
2. Extract metadata: title, summary, keywords from frontmatter
3. Count existing internal links in each page
4. Batch-classify all pages via LLM (section type: reference/guide/tutorial/overview/other)
5. Compute adjacency (pages in same directory)
6. Persist to `.crossref-state/index.json`
7. Reset `processed` array so all pages become candidates

**Output:** Complete page index with metadata and section types.

#### 3.3.2. Process Phase (`workflows/phases/process.ts`)

**Purpose:** Analyze unprocessed pages, generate suggestions, and apply high-confidence links.

**Process per page:**
1. Find next unprocessed page (or use `targetFile`/`targetDir`)
2. Load page content from disk
3. Prepare context: page index, adjacent pages, full content
4. Call page-linker agent to analyze
5. Parse and validate suggestions (schema validation)
6. For each suggestion:
   - Validate path safety (no traversal, symlink-safe)
   - Check if already linked (deduplication)
   - Check if anchor exists in target
   - Apply if high-confidence, queue if medium/low
7. Update source page with inserted links
8. Mark page as processed
9. Save state

**Output:** Updated markdown files + accumulated suggestions in state.

#### 3.3.3. Report Phase (`workflows/phases/report.ts`)

**Purpose:** Analyze coverage and generate statistics.

**Metrics:**
- **Coverage:** Total pages, % processed, pending count
- **Suggestions:** Applied/skipped/pending counts, confidence distribution
- **Link Density:** Average outgoing links per page by section type
- **Orphans:** Pages with zero incoming links
- **Token Spend:** Cumulative cost to date

**Output:** Human-readable coverage report (no file modifications).

---

### 3.4. Tools (Agent-Accessible)

**Name:** Agent Tools

**Description:** Flue tools exposed to the LLM agent for information retrieval and validation during reasoning.

**Tools:**

| Tool                     | Purpose                              | Parameters                                                |
|--------------------------|--------------------------------------|-----------------------------------------------------------|
| `search_pages`           | Find pages by title/keywords/topic   | `query` (string), `limit` (number, default 5)             |
| `search_page_content`    | Find phrases/anchors in page prose   | `targetId` (string), `terms` (string[]), `limit` (number) |
| `validate_anchor`        | Check if heading exists              | `targetId` (string), `anchorText` (string)                |
| `extract_page_structure` | Get full TOC                         | `targetId` (string)                                       |
| `get_adjacent_pages`     | Find pages in same section           | `targetId` (string)                                       |
| `extract_page_metadata`  | Extract missing description/keywords | `targetId` (string)                                       |

**Note on File I/O:** Document reading and writing is performed directly in workflow phases (`workflows/phases/process.ts`) using Node.js `fs.readFileSync` and `fs.writeFileSync`. These operations include path safety validation (realpath checks, boundary enforcement) identical to what dedicated Flue tools would provide, so separate tool definitions are unnecessary.

---

### 3.5. Data Structures & Schemas

**Location:** `lib/schemas.ts`

**Key Types:**

```typescript
// Page metadata
PageIndexEntry {
  id: string,                    // Unique ID (file path slug)
  title: string,                 // Page title
  path: string,                  // Relative path from docs
  absPath: string,               // Absolute file path
  description?: string,          // From frontmatter or extracted
  keywords?: string[],           // From frontmatter or extracted
  contextualTitle?: string,      // Alternative title
  existingLinkCount: number,     // Links already in page
  adjacentPages?: string[]       // IDs of same-section pages
}

// Suggestion from agent
LinkSuggestion {
  sourceId: string,              // Page being analyzed
  targetId: string,              // Target page (from index)
  targetTitle: string,           // Target page title
  targetRelativePath: string,    // Computed relative path (not from LLM)
  anchorText: string,            // 1-5 word phrase to link
  description?: string,          // Why it's related (See Also)
  type: 'inline' | 'see_also',   // Link placement
  confidence: 'high' | 'medium' | 'low',
  reasoning: string,             // Why this link was suggested
  status: 'pending' | 'applied' | 'skipped'
}

// Full state
CrossrefState {
  indexBuiltAt: string,          // ISO timestamp
  docsDir: string,               // Docs path
  index: PageIndexEntry[],       // All pages
  processed: string[],           // IDs of processed pages
  suggestions: LinkSuggestion[], // Accumulated suggestions
  tokens: {                      // Token tracking
    inputTotal: number,
    outputTotal: number,
    runningCost: number
  }
}
```

---

### 3.6. State Management

**Location:** `lib/state-store.ts`

**Persistence:**
- State split into `.crossref-state/index.json` (pages) and `.crossref-state/suggestions.json` (suggestions)
- Backward-compatible migration for old `state.json` format
- Atomic writes with error recovery (silently skips corrupt files)

**Loading:**
- Lazy initialization: empty state if no files exist
- Parse with Valibot for type safety
- Fall back to empty on parse error (prevents crashes)

**Saving:**
- Create `.crossref-state/` directory if missing
- Write index and suggestions as separate JSON files
- Suggestions accumulate (never truncated)

---

### 3.7. Markdown Parsing & Safety

**Location:** `lib/markdown-parser.ts`

**Capabilities:**
- Extract YAML frontmatter (preserve untouched)
- Parse headings and outline
- Identify safe zones: code fences (`` ``` ``, `~~~`), inline code (`` ` ``)
- Find existing links
- Safe phrase matching (case-insensitive find, exact-case replacement)

**Safety Guarantees:**
- Links inserted only in prose (not headings, code, frontmatter)
- Code blocks fully protected (never modified)
- Inline code protected (never modified)
- Phrase matching validates complete words (not substrings)

---

### 3.8. Link Insertion & Validation

**Location:** `workflows/utils/link-inserter.ts`, `workflows/utils/link-validator.ts`

**Link Inserter:**
- Insert inline links: `` `[Fiber](./path.md)` `` in prose
- Insert See Also sections at end of page with format:
  ```markdown
  ## See Also
  - [Related Topic](./path.md) — Description
  ```
- Fallback: find partial phrase matches if exact doesn't exist

**Link Validator:**
- Path safety: resolve symlinks, check within docs boundary
- Duplicate detection: verify anchor not already linked in page
- Anchor validation: confirm heading/section exists in target
- TOCTOU safety: read files, don't check then act

---

### 3.9. Configuration

**Location:** `lib/config-loader.ts`

**File:** `.crossref-config.json` (in parent of docs)

**Options:**
```json
{
  "excludePatterns": ["node_modules", ".github"],
  "maxLinksPerPage": 5,
  "confidenceThreshold": "high"
}
```

**Defaults:** `[]`, `5`, `"high"`

---


---

## 4. Data Stores

### 4.1. Index Store

**Name:** Documentation Index (`.crossref-state/index.json`)

**Type:** JSON

**Purpose:** Metadata for all discovered pages, enabling fast search and adjacency lookup.

**Key Collections:**
- `index[]` — Array of `PageIndexEntry` objects
- Each entry contains: id, title, path, description, keywords, sectionType, adjacentPages

### 4.2. Suggestions Store

**Name:** Link Suggestions (`.crossref-state/suggestions.json`)

**Type:** JSON

**Purpose:** Accumulates all suggestions (applied, pending, skipped) for review and analytics.

**Key Collections:**
- `suggestions[]` — Array of `LinkSuggestion` objects
- Each entry contains: sourceId, targetId, anchorText, type, confidence, status

## 5. Deployment & Infrastructure

**Architecture:** Headless workflow executor

**Typical Usage:**
- Developer runs: `npx flue run crossref --target node --payload '{...}'`
- CI/CD can invoke with payload parameters

## 6. Development & Testing Environment

**Local Setup:**
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Create .env with API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run tests
npm test
```

**Testing Frameworks:**
- **Vitest** — Test runner and assertion library
- **Fixtures** — Test docs in-memory or temporary directories

**Code Quality:**
- **TypeScript strict mode** — All source files
- **Valibot schemas** — Runtime validation
- **No linter** — Relies on type checking
