# Architecture Overview
This document serves as a critical, living template designed to equip agents with a rapid and comprehensive understanding of the codebase's architecture, enabling efficient navigation and effective contribution from day one. Update this document as the codebase evolves.

## 1. Project Structure

```
crossref-agent/
├── agents/
│   └── page-linker.ts              # Claude Haiku 4.5 agent (Flue-based)
├── lib/
│   ├── config-loader.ts            # Configuration management
│   ├── markdown-parser.ts           # YAML frontmatter, headings, links extraction
│   ├── migrate-state.ts            # State migration logic
│   ├── schemas.ts                  # Valibot schema definitions
│   ├── state-store.ts              # Persistent state (index.json, suggestions.json)
│   └── title-utils.ts              # Title classification utilities
├── tools/
│   ├── extract_page_structure.ts   # Extract page structure (Flue tool)
│   ├── get_adjacent_pages.ts       # Get pages from sidebar (Flue tool)
│   ├── read_doc.ts                 # Read documentation file (Flue tool)
│   ├── search_page_content.ts      # Search content with context (Flue tool)
│   ├── search_pages.ts             # Search page index (Flue tool)
│   ├── validate_anchor.ts          # Validate anchor text (Flue tool)
│   └── write_doc.ts                # Write documentation file (Flue tool)
├── workflows/
│   ├── crossref.ts                 # Main orchestration workflow
│   ├── phases/
│   │   ├── reindex.ts              # Phase 1: Build/rebuild page index
│   │   ├── process.ts              # Phase 2-4: Suggest, enrich, apply links
│   │   └── report.ts               # Report generation
│   └── utils/
│       ├── sidebar-parser.ts       # Parse sidebars.js for adjacency
│       └── metadata-utilities.ts   # Contextual title generation
├── skills/
│   └── cross-linker/
│       └── SKILL.md                # LLM instructions for page-linker agent
├── tests/
│   ├── link-inserter.test.ts       # Link insertion logic tests
│   ├── link-validator.test.ts      # Path/symlink validation tests
│   ├── markdown-parser.test.ts     # Markdown parsing tests
│   ├── migration.test.ts           # State migration tests
│   └── workflow-smoke.test.ts      # End-to-end workflow tests
├── dist/                           # Compiled TypeScript (not in git)
├── .env                            # Anthropic API key (not in git)
├── .crossref-state/                # Runtime state directory (not in git)
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── AGENTS.md                       # Agent configuration
├── AGENT_RUNNING_GUIDE.md
└── ARCHITECTURE.md                 # This file
```

## 2. High-Level System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                  CROSSREF AGENT SYSTEM FLOW                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input: /docs (Markdown/MDX files)                              │
│    ↓                                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PHASE 1: REINDEX (mode: "reindex")                    │     │
│  │ - Walk docs tree, extract metadata                    │     │
│  │ - Parse sidebars.js for adjacent pages                │     │
│  │ - Build searchable index of all pages                 │     │
│  │ → Output: .crossref-state/index.json                  │     │
│  └────────────────────────────────────────────────────────┘     │
│    ↓                                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PHASE 2: SUGGESTION GENERATION (mode: "step"/autopilot) │    │
│  │ For each unprocessed page:                            │     │
│  │   - Load page content from disk                       │     │
│  │   - Invoke page-linker Claude agent with:            │     │
│  │     * Full page index                                 │     │
│  │     * Adjacent pages (from sidebar)                   │     │
│  │     * Full page content                               │     │
│  │   - Agent analyzes and returns JSON suggestions       │     │
│  │ → Output: Raw suggestions from LLM                    │     │
│  └────────────────────────────────────────────────────────┘     │
│    ↓                                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PHASE 3: ENRICHMENT & VALIDATION                      │     │
│  │ - Find target pages in index                          │     │
│  │ - Compute relative paths                             │     │
│  │ - Check for duplicates in state.suggestions          │     │
│  │ - Validate paths for safety (symlinks, traversal)    │     │
│  │ → Output: state.suggestions (accumulated)            │     │
│  └────────────────────────────────────────────────────────┘     │
│    ↓                                                             │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PHASE 4: APPLICATION & STATE PERSISTENCE              │     │
│  │ For high-confidence suggestions:                      │     │
│  │   - Insert link into page (inline or See Also)        │     │
│  │   - Write page to disk                                │     │
│  │   - Mark suggestion as "applied" in state             │     │
│  │ → Output: Updated .md/.mdx files on disk              │     │
│  │ → Save: .crossref-state/suggestions.json              │     │
│  └────────────────────────────────────────────────────────┘     │
│    ↓                                                             │
│  PHASE 5: REPORTING (mode: "report")                            │
│  - Show coverage, link density, orphan detection                │
│  - Token usage and cost tracking                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Core Components

### 3.1. Orchestration Layer

**workflows/crossref.ts**
- Main entry point that routes between execution modes
- Modes: `reindex` (build index), `step` (process incrementally), `autopilot` (process all), `report` (analyze coverage)
- Initializes the Flue harness with page-linker agent
- Loads/saves state, coordinates phases
- Payload params: `docsDir`, `mode`, `batchSize`, `targetFile`, `targetDir`

### 3.2. Workflow Phases

**workflows/phases/reindex.ts** (Phase 1)
- Walks docs directory respecting `excludePatterns`
- Extracts metadata: title, description, keywords from YAML frontmatter
- Classifies section type (reference/guide/tutorial/overview/other) via LLM
- Parses sidebars.js for adjacent page relationships
- Builds searchable index with `id`, `title`, `path`, `absPath`, `description`, `keywords`, `sectionType`
- Resets processed array so all pages analyzed fresh
- Persists state to `.crossref-state/`

**workflows/phases/process.ts** (Phases 2-4)
- Batch processor for unprocessed or targeted pages
- For each page:
  - Loads full content from disk
  - Invokes page-linker Claude agent (Flue task)
  - Receives suggestions JSON: `[{ targetId, anchorText, type, confidence, reasoning }]`
  - Enriches with computed `targetRelativePath` (never from LLM)
  - Deduplicates against existing state.suggestions
  - Validates paths for safety and correctness
  - Applies high-confidence (≥threshold) links directly to disk
  - Queues medium/low-confidence for human review
  - Saves state after each page

**workflows/phases/report.ts** (Phase 5)
- Analyzes state for coverage metrics
- Shows: total pages, processed %, pending suggestions, link density by section type
- Lists orphan pages (no incoming links)
- Summarizes token usage and cost
- Outputs human-readable report

### 3.3. Agent Layer

**agents/page-linker.ts**
- Flue-based Claude Haiku 4.5 agent
- Single responsibility: analyze a page and identify cross-linking opportunities
- Uses `cross-linker` skill for LLM instructions
- Invoked once per page during Phase 2
- Returns structured suggestions meeting the output schema

**skills/cross-linker/SKILL.md**
- LLM instructions for page-linker agent
- Teaches agent to identify inline and See Also linking opportunities
- Covers anchor text selection, confidence levels, and validation
- Defines helper tools available to the agent

### 3.4. Tool Layer (Flue Tools)

Tools are available to Claude during page-linker execution:

- **search_pages.ts** — Query index by title/keywords, return top 5 matches
- **extract_page_structure.ts** — Get page headings, sections, metadata
- **get_adjacent_pages.ts** — Retrieve pages from sidebar for current page
- **search_page_content.ts** — Find text snippets with context (for anchor validation)
- **read_doc.ts** — Read full document content from disk
- **write_doc.ts** — Write document to disk (not used during suggestion phase)
- **validate_anchor.ts** — Verify anchor text exists in prose (not code/frontmatter)

### 3.5. Infrastructure Layer

**lib/schemas.ts**
- Valibot schema definitions for all data structures
- Key types: `PageIndexEntry`, `LinkSuggestion`, `CrossrefState`, `CrossrefConfig`
- Section types: reference, guide, tutorial, overview, other
- Confidence levels: low, medium, high
- Link types: inline, see_also
- Suggestion statuses: pending, applied, skipped

**lib/state-store.ts**
- Persistent state management using two JSON files:
  - `.crossref-state/index.json` — Page index (built in Phase 1)
  - `.crossref-state/suggestions.json` — Processed pages, suggestions, token tracking
- Functions: `loadState()`, `saveState()`, `loadIndex()`, `loadSuggestions()`
- Handles backward compatibility and state migration
- Validates critical fields (absPath, id) with error recovery

**lib/config-loader.ts**
- Loads `.crossref-config.json` from docs parent directory
- Options: `excludePatterns`, `maxLinksPerPage`, `maxSeeAlsoSuggestion`, `confidenceThreshold`
- Provides sensible defaults

**lib/markdown-parser.ts**
- Pure parsing utilities (no side effects)
- Functions: `parseFrontmatter()`, `extractTitle()`, `extractExistingLinks()`, `parseHeadings()`
- Identifies safe zones (code fences, inline code) to protect from link insertion

**lib/title-utils.ts**
- Classifies if a title is generic (e.g., "Fiber", "Resource")
- Used to determine if contextual title generation is needed

## 4. Data Stores

### State Files (.crossref-state/)

**.crossref-state/index.json**
- Page index persisted from Phase 1
- Schema: `{ indexBuiltAt, docsDir, index: PageIndexEntry[] }`
- Each entry: `{ id, title, path, absPath, description?, keywords?, contextualTitle?, existingLinkCount, adjacentPages }`
- Built once per reindex; immutable between step runs

**.crossref-state/suggestions.json**
- Suggestions, processed pages, token tracking
- Schema: `{ processed: string[], suggestions: LinkSuggestion[], sectionType: {}, tokens }`
- Accumulated across step runs
- Grows as suggestions are generated and applied

### Configuration

**.crossref-config.json** (optional, in docs parent directory)
```json
{
  "excludePatterns": ["node_modules", ".github", "archived"],
  "maxLinksPerPage": 5,
  "maxSeeAlsoSuggestion": 3,
  "confidenceThreshold": "high"
}
```

## 5. External Integrations / APIs

### Anthropic Claude API
- **Model**: Claude Haiku 4.5 (`anthropic/claude-haiku-4-5`)
- **Usage**: Page-linker agent calls Claude once per page to analyze linking opportunities
- **Tokens tracked**: Input tokens (prompt), output tokens (response), cumulative cost
- **Authentication**: Via `ANTHROPIC_API_KEY` environment variable in `.env`

### Flue Framework
- **Purpose**: Agent runtime and orchestration
- **Version**: ^0.8.1
- **Core concepts**:
  - Agent: page-linker (Claude-based)
  - Skills: cross-linker (LLM instructions)
  - Tools: Helper functions invoked during agent execution
  - Session: Maintains context across multiple agent invocations
  - Harness: Coordinates initialization and execution

## 6. Deployment & Infrastructure

### Runtime Environment
- **Platform**: Node.js 18+ (ES2022 target)
- **Language**: TypeScript 5.4+
- **Build**: TypeScript compiler (`tsc`), output to `dist/`
- **Execution**: `flue run workflows/crossref.ts --target node`

### Invocation Methods
1. **CLI** (Flue CLI): `flue run crossref --target node --payload '{...}'`
2. **Programmatic** (via Flue runtime): Import and invoke `run({ init, payload })`

### State Persistence
- Stored locally in `.crossref-state/` (directory created on first run)
- No remote storage required; state is tied to single docs directory
- State migration handles version upgrades automatically

### Environment
- **API Key**: Anthropic key in `.env` (not committed)
- **Docs Directory**: Specified per invocation in payload
- **Config**: Optional `.crossref-config.json` in parent of docs directory

## 7. Security Considerations

### Path Safety
- **Symlink handling**: All paths resolved with `realpathSync()` to real target
- **Boundary checking**: Resolved paths validated to exist within docs directory
- **Traversal protection**: Relative paths computed and validated (no `../../../` escapes)

### LLM Output Validation
- **Schema validation**: All LLM outputs validated against Valibot schemas before persistence
- **Path safety**: `targetRelativePath` computed deterministically in code, never accepted from LLM
- **Anchor text**: Verified to exist in document prose (not code blocks or frontmatter)

### Filesystem Safety
- **TOCTOU protection**: Operations use try-catch on actual file reads, not existence checks
- **Error recovery**: Unreadable files skipped with warnings; state only updated if complete
- **Permissions**: File I/O respects OS-level permissions; graceful failures if unreadable

## 8. Development & Testing Environment

### Testing Framework
- **Runner**: Vitest 3.0+
- **Test files**: `tests/**/*.test.ts`
- **Commands**: `npm test` (run once), `npm test:watch` (continuous)

### Test Coverage
- **markdown-parser.test.ts** (19 tests) — Frontmatter, headings, links, safe zones
- **link-inserter.test.ts** (11 tests) — Inline and See Also insertion, code-fence safety
- **link-validator.test.ts** (4 tests) — Path validation, symlinks, duplicates
- **workflow-smoke.test.ts** (9 tests) — End-to-end workflow with fixture docs
- **migration.test.ts** (16 tests) — State migration logic

### Type Checking
- Command: `npx tsc --noEmit`
- Strict mode enabled in `tsconfig.json`

### Development Commands
- `npm run build` — Compile TypeScript to `dist/`
- `npm test` — Run all tests once
- `npm test:watch` — Run tests in watch mode
- `flue run crossref --target node` — Execute workflow locally

## 9. Future Considerations / Roadmap

### Known Limitations
- Reindex is atomic (processes all pages at once; no incremental reindex)
- LLM suggestions cannot be manually overridden mid-workflow
- No conflict detection for overlapping anchor text in same page
- No analytics dashboard for link growth over time

### Potential Enhancements
- **Incremental reindex**: Update only changed files (hash-based)
- **Suggestion override UI**: Manual editing/acceptance interface
- **Analytics**: Track link density changes, coverage trends
- **Platform integration**: Native plugins for Docusaurus, MkDocs, Markdown sites
- **Batch review UI**: Visual interface for reviewing medium/low-confidence suggestions
- **Link conflict resolution**: Detect and resolve overlapping anchor text

### Scalability Notes
- Current performance: ~30 pages/minute with Haiku 4.5
- Cost: ~$0.015 per page (~3000 tokens per analysis)
- Token batching: Single LLM call per page (not batched across pages)
- Future: Consider batch classification of metadata for reindex phase

## 10. Project Identification

| Attribute | Value |
|-----------|-------|
| **Project Name** | Crossref Agent |
| **Description** | Flue-based TypeScript agent that automatically discovers and creates cross-references between pages in Markdown documentation |
| **Repository** | https://github.com/zio/skills/tree/main/crossref-agent |
| **Version** | 0.1.0 |
| **Contact** | Milad Khajavi (milad.khajavi@ziverge.com) |
| **Last Updated** | 2026-06-05 |
| **License** | Part of ZIO Skills (see parent LICENSE) |

## 11. Glossary / Acronyms

| Term | Definition |
|------|-----------|
| **Anchor Text** | The visible text of a hyperlink (e.g., "Fiber" in `[Fiber](./path.md)`) |
| **Adjacent Pages** | Pages in the same section/directory; relationship derived from sidebar structure |
| **Confidence Level** | Assessment of link quality: high (title match/central), medium (conceptual overlap), low (tangential) |
| **Contextual Title** | AI-generated improved title for generic page titles (e.g., "Service" → "Service Lifecycle Patterns") |
| **Frontmatter** | YAML metadata block at top of Markdown file (between `---` delimiters) |
| **Inline Link** | Hyperlink embedded in prose (e.g., `[Fiber](path.md)` within a sentence) |
| **See Also** | Section at end of page with related links (e.g., "- [Fiber](path.md) — Lightweight virtual thread") |
| **Section Type** | Classification of page (reference, guide, tutorial, overview, other) |
| **TOCTOU** | Time-of-check to time-of-use; filesystem race condition pattern |
| **Valibot** | TypeScript schema validation library used for runtime type checking |
| **Flue** | Agent orchestration framework for building Claude-based agents with skills and tools |
| **Haiku 4.5** | Fast, low-cost Claude model used for page-linker agent |
