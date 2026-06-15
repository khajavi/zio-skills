# Writer Assistant Architecture

A TypeScript-based documentation workflow framework built on the Flue runtime, designed to automate and enhance documentation generation, styling, cross-linking, and validation for large-scale projects.

## 1. Project Overview

The writer-assistant orchestrates multiple specialized agents and workflows to handle different documentation tasks:

- **Cross-reference linking** — Discover and insert internal links between documentation pages
- **Data type documentation** — Generate comprehensive API reference documentation from source code
- **Metadata enrichment** — Extract and populate metadata (title, description, keywords) for pages
- **Writing style validation** — Check and fix documentation for style compliance
- **Documentation builds** — Verify and auto-fix documentation build failures

```
writer-assistant/
├── agents/                       # Claude agents (Flue-based)
│   ├── page-linker.ts           # Cross-reference analysis
│   ├── docs-writer.ts           # Documentation generation
│   ├── docs-researcher.ts       # Research and gathering
│   ├── metadata-extractor.ts    # Metadata extraction
│   ├── docs-style-checker.ts    # Writing style validation
│   ├── docs-reviewer.ts         # Content review
│   └── coding-agent.ts          # General software engineering
│
├── workflows/                    # Workflow orchestrators
│   ├── crossref.ts              # Main cross-reference workflow (6 modes)
│   ├── write-data-type-ref.ts   # API reference generation
│   ├── extract-metadata.ts      # Metadata extraction workflow
│   ├── fix-writing-style.ts     # Writing style fixing workflow
│   ├── coding-agent.ts          # Coding task dispatch
│   │
│   ├── phases/                  # Workflow execution phases
│   │   ├── reindex.ts           # Build documentation index
│   │   ├── process.ts           # Process pages, generate suggestions
│   │   ├── research.ts          # Gather information
│   │   ├── review.ts            # Review content
│   │   ├── style.ts             # Apply style fixes
│   │   ├── verify.ts            # Verify build success
│   │   └── report.ts            # Generate coverage reports
│   │
│   └── utils/                   # Shared utilities
│       ├── link-inserter.ts     # Insert links into markdown
│       ├── link-validator.ts    # Validate link safety and correctness
│       ├── metadata-utilities.ts # Extract/manage metadata
│       ├── confidence.ts        # Confidence threshold checking
│       ├── cost.ts              # Token cost estimation
│       ├── yaml.ts              # YAML frontmatter manipulation
│       └── sidebar-parser.ts    # Docusaurus sidebar parsing
│
├── lib/                         # Core libraries
│   ├── schemas.ts               # Valibot data structures
│   ├── state-store.ts           # Persistent state management
│   ├── config-loader.ts         # Configuration loading
│   ├── markdown-parser.ts       # Markdown parsing and safety
│   ├── title-utils.ts           # Title normalization
│   ├── auto-fixer.ts            # Automated error fixing
│   ├── build-error-extractor.ts # Parse build output for errors
│   ├── scala-source-discovery.ts # Scala source code finding
│   └── migrate-state.ts         # State format migration
│
├── tools/                       # Flue tools for agents
│   ├── run_mdoc.ts              # mdoc executable tool
│   └── (additional Flue tools)
│
├── skills/                      # LLM instruction skills
│   ├── cross-linker/
│   │   └── SKILL.md             # Cross-linking strategy
│   ├── docs-data-type-ref/
│   │   └── SKILL.md             # API documentation structure
│   ├── docs-research/
│   │   └── SKILL.md             # Research methodology
│   ├── docs-writing-style-mechanical/
│   │   └── SKILL.md             # Mechanical style rules (punctuation, formatting)
│   ├── docs-writing-style-judgment/
│   │   └── SKILL.md             # Judgment-based style rules (clarity, tone)
│   └── metadata-extractor/
│       └── SKILL.md             # Metadata extraction from content
│
├── tests/                       # Vitest test suite
│   ├── markdown-parser.test.ts
│   ├── link-inserter.test.ts
│   ├── link-validator.test.ts
│   ├── migration.test.ts
│   └── workflow-smoke.test.ts
│
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Test runner configuration
└── ARCHITECTURE.md              # This file
```

## 2. System Architecture

### 2.1. High-Level Workflow Model

```
User Input (CLI/API)
    ↓
FlueContext with payload
    ↓
Workflow (crossref.ts, write-data-type-ref.ts, etc.)
    ├─ Load configuration
    ├─ Load or initialize state
    ├─ Route to appropriate phase(s)
    ├─ Spawn agents (docs-writer, page-linker, etc.)
    │   └─ Agent makes tool calls
    │   └─ Agent returns structured output
    ├─ Post-process and validate results
    ├─ Update state/files
    └─ Return results
    ↓
Updated Documentation + State
```

### 2.2. Agent Architecture

All agents are built on the Flue framework and use Claude Haiku 4.5 as the base model. Each agent has:

1. **Agent profile** (`agents/*.ts`) — Flue agent configuration with model selection and tool bindings
2. **Skill instructions** (`skills/*/SKILL.md`) — LLM prompts teaching the agent what/how to do its job
3. **Tools** — Access to filesystem, external APIs, or specialized functions via Flue's tool system

**Agent Deployment:**

```
agents/page-linker.ts
    ↓
Flue Agent Profile (Claude Haiku 4.5)
    ↓
Runs with skill: skills/cross-linker/SKILL.md
    ↓
Calls tools: search_pages, validate_anchor, extract_page_structure, etc.
    ↓
Returns JSON: { suggestions: [...] }
```

## 3. Core Workflows

### 3.1. Crossref Workflow (`workflows/crossref.ts`)

**Purpose:** Discover and insert cross-references between documentation pages.

**Modes:**

| Mode           | Purpose                                       | Output                          |
|----------------|-----------------------------------------------|---------------------------------|
| `reindex`      | Build fresh documentation index              | `.crossref-state/index.json`    |
| `step`         | Process one page batch, apply high-conf links| Updated .md files + state       |
| `autopilot`    | Loop `step` until all pages processed        | Complete documentation updated  |
| `report`       | Analyze coverage, orphans, link density      | Coverage report (stdout)        |
| `verify`       | Verify documentation build succeeds          | Build result JSON               |
| `verify-and-fix` | Auto-fix build failures, re-verify         | Fixed docs + build success/fail |

**State Management:**

- **Location:** `.crossref-state/index.json` (pages) and `.crossref-state/suggestions.json` (suggestions)
- **Lifecycle:**
  - `reindex` — Clears processed array, rebuilds index
  - `step` — Marks pages as processed, accumulates suggestions
  - `autopilot` — Loops step mode until completion
  - All modes — Atomic writes with error recovery

**Data Flow (Step Mode):**

```
Find next unprocessed page
    ↓
Load page content from disk
    ↓
Create context: { pageIndex, adjacentPages, content }
    ↓
Call page-linker agent → suggestions JSON
    ↓
Validate & enrich suggestions
    ├─ Compute relative paths
    ├─ Check anchor existence
    ├─ Deduplicate vs prior suggestions
    └─ Filter by confidence threshold
    ↓
Apply high-confidence links to disk
    ↓
Mark page as processed
    ↓
Persist state
```

### 3.2. Write Data Type Reference Workflow (`workflows/write-data-type-ref.ts`)

**Purpose:** Generate comprehensive API reference documentation from Scala source code.

**Phases:**

1. **Research Phase** — Analyze source code, extract type information, gather usage examples
2. **Review Phase** — Validate extracted information, check for completeness
3. **Style Phase** — Apply writing style fixes and standards
4. **Mdoc Execution** — Run mdoc to compile examples in documentation

**Input:**

```json
{
  "projectRoot": "/path/to/project",
  "dataTypePath": "zio/Fiber.scala",
  "outputPath": "docs/reference/fiber.md"
}
```

**Output:** Markdown file with:
- Type signature and constructor
- Method reference documentation
- Usage examples (mdoc-compiled)
- Links to related types
- See Also section

### 3.3. Extract Metadata Workflow (`workflows/extract-metadata.ts`)

**Purpose:** Extract or generate metadata (title, description, keywords) for documentation pages.

**Modes:**

| Mode      | Use Case                                      |
|-----------|-----------------------------------------------|
| `all`     | Extract metadata for all pages (pre-enrichment)|
| `missing` | Extract only for pages without metadata      |
| `file`    | Extract for single specific file             |
| `dir`     | Extract for all pages in directory recursively|

**Output:** Page frontmatter updated with:
```yaml
---
title: "Page Title"
description: "Natural language summary"
keywords: ["keyword1", "keyword2"]
---
```

### 3.4. Fix Writing Style Workflow (`workflows/fix-writing-style.ts`)

**Purpose:** Validate and fix documentation for style compliance.

**Two-Layer Validation:**

1. **Mechanical Layer** — Rules-based fixes (punctuation, spacing, formatting)
2. **Judgment Layer** — LLM-based evaluation (clarity, tone, word choice)

**Output:** Updated .md files with style improvements.

## 4. Core Components

### 4.1. State Store (`lib/state-store.ts`)

**Responsibilities:**
- Load/save index and suggestions from/to disk
- Migrate old state formats for backwards compatibility
- Atomic writes with error recovery
- Lazy initialization (empty state if not found)

**State Structure:**

```typescript
type CrossrefState = {
  indexBuiltAt: string,           // ISO timestamp
  docsDir: string,                // Documentation directory path
  index: PageIndexEntry[],        // All discovered pages
  processed: string[],            // IDs of processed pages
  suggestions: LinkSuggestion[],  // All suggestions (accumulated)
  tokens: {
    inputTotal: number,
    outputTotal: number,
    runningCost: number
  }
}

type PageIndexEntry = {
  id: string,                     // Unique ID (slug from path)
  title: string,
  path: string,                   // Relative path from docs
  absPath: string,                // Absolute filesystem path
  description?: string,           // From frontmatter or extracted
  keywords?: string[],            // From frontmatter or extracted
  contextualTitle?: string,       // Alternative title
  sectionType?: string,           // "reference" | "guide" | "tutorial" | "overview" | "other"
  existingLinkCount: number,
  adjacentPages?: string[]        // Page IDs in same directory
}

type LinkSuggestion = {
  sourceId: string,               // Page being analyzed
  targetId: string,               // Target page (from index)
  targetTitle: string,
  targetRelativePath: string,     // Computed (never from LLM)
  anchorText: string,             // 1-5 word phrase to link
  description?: string,           // Why it's related
  type: 'inline' | 'see_also',
  confidence: 'high' | 'medium' | 'low',
  reasoning: string,
  status: 'pending' | 'applied' | 'skipped'
}
```

### 4.2. Markdown Parser (`lib/markdown-parser.ts`)

**Capabilities:**

- Extract YAML frontmatter (preserve untouched)
- Parse headings and build outline
- Identify safe zones: code fences (` ``` `, `~~~`), inline code
- Find existing internal links
- Safe phrase matching with word boundary validation

**Safety Guarantees:**

- Links inserted only in prose (not headings, code, frontmatter)
- Code blocks fully protected
- Inline code protected
- Complete word matching (not substring)

### 4.3. Link Insertion & Validation

**Link Inserter** (`workflows/utils/link-inserter.ts`):
- Insert inline links: `[Text](./path.md)` in prose
- Insert See Also sections at end of page
- Fallback: find partial matches if exact not found

**Link Validator** (`workflows/utils/link-validator.ts`):
- Path safety: symlink resolution, boundary checks
- Duplicate detection: anchor not already linked
- Anchor validation: heading exists in target
- TOCTOU-safe: read then act (not check then act)

### 4.4. Configuration (`lib/config-loader.ts`)

**File:** `.crossref-config.json` (in parent of docs)

**Options:**

```json
{
  "excludePatterns": ["node_modules", ".github"],
  "maxLinksPerPage": 10,
  "maxSeeAlsoSuggestion": 5,
  "confidenceThreshold": "high",
  "clearSuggestionsBeforeRun": false
}
```

### 4.5. Build Verification & Auto-Fixing

**Verify Phase** (`workflows/phases/verify.ts`):
- Auto-detect build system: Docusaurus, MkDocs, Sphinx, Hugo
- Run build command
- Parse output for success/failure

**Auto-Fixer** (`lib/auto-fixer.ts`):
- Extract structured errors from build output
- Analyze errors holistically
- Dispatch `coding-agent` to fix files
- Re-verify and retry

**Fixable Issues:**
- Broken links (missing extensions, wrong paths, bad anchors)
- Syntax errors (unclosed code fences, YAML issues)
- Missing files (remove broken references)
- Configuration problems (docusaurus.config.js, etc.)

## 5. Agent Catalog

### 5.1. Page Linker Agent (`agents/page-linker.ts`)

**Model:** Claude Haiku 4.5  
**Skill:** `skills/cross-linker/SKILL.md`

**Capabilities:**
- Analyzes page content for cross-linking opportunities
- Searches documentation index
- Validates anchor existence
- Returns structured suggestions (confidence levels)

**Tool Availability:**
- `search_pages` — Find pages by query
- `search_page_content` — Search page prose for terms
- `validate_anchor` — Check if heading exists
- `extract_page_structure` — Get full TOC
- `get_adjacent_pages` — Find related pages

### 5.2. Docs Writer Agent (`agents/docs-writer.ts`)

**Model:** Claude Haiku 4.5  
**Skill:** `skills/docs-data-type-ref/SKILL.md`

**Capabilities:**
- Generates API reference documentation from code
- Structures documentation by type signature, methods, examples
- Creates See Also links
- Applies inline examples

### 5.3. Docs Researcher Agent (`agents/docs-researcher.ts`)

**Model:** Claude Haiku 4.5  
**Skill:** `skills/docs-research/SKILL.md`

**Capabilities:**
- Gathers information from source code
- Extracts type signatures and method names
- Identifies usage patterns
- Compiles usage examples

### 5.4. Metadata Extractor Agent (`agents/metadata-extractor.ts`)

**Model:** Claude Haiku 4.5  
**Skill:** `skills/metadata-extractor/SKILL.md`

**Capabilities:**
- Extracts or generates metadata from page content
- Infers title from frontmatter or heading
- Generates natural language description
- Identifies relevant keywords

### 5.5. Style Checker Agent (`agents/docs-style-checker.ts`)

**Model:** Claude Haiku 4.5  
**Skill:** `skills/docs-writing-style-judgment/SKILL.md`

**Capabilities:**
- Validates prose clarity and tone
- Checks terminology consistency
- Identifies style issues requiring judgment
- Proposes targeted improvements

### 5.6. Docs Reviewer Agent (`agents/docs-reviewer.ts`)

**Capabilities:**
- Reviews documentation completeness
- Validates examples compile and work
- Checks internal consistency
- Identifies missing documentation

### 5.7. Coding Agent (`agents/coding-agent.ts`)

**Model:** Claude Haiku 4.5

**Capabilities:**
- General-purpose software engineering tasks
- Modifies files to fix errors
- Handles cross-project dependencies
- Used for auto-fixing build failures

## 6. Skill Architecture

Skills are stored as markdown files (`SKILL.md`) in `skills/*/` directories. Each skill:

1. **Defines trigger conditions** — When agents should use this skill
2. **Teaches methodology** — How to approach the task
3. **Provides examples** — Concrete examples of correct output
4. **References code** — Links to real examples in the codebase

**Skill List:**

- **cross-linker** — Identify cross-linking opportunities, select anchor text, determine confidence
- **docs-data-type-ref** — Structure API documentation, organize methods, create examples
- **docs-research** — Gather code information, extract signatures, find usage
- **docs-writing-style-mechanical** — Punctuation, spacing, formatting rules
- **docs-writing-style-judgment** — Clarity, tone, word choice evaluation
- **metadata-extractor** — Extract title, description, keywords from content

## 7. Data Stores

### 7.1. Documentation Index (`.crossref-state/index.json`)

**Type:** JSON array of `PageIndexEntry` objects

**Purpose:**
- Fast search by title, keywords, topic
- Enable adjacency queries
- Track metadata (sectionType, existingLinkCount)
- Support report generation (coverage, orphans)

### 7.2. Page Frontmatter

**Location:** YAML header in each `.md` file

**Fields:**
```yaml
---
title: "Page Title"
description: "1-3 sentence summary"
keywords: ["keyword1", "keyword2"]
---
```

**Usage:**
- Populated by `extract-metadata` workflow
- Used by `page-linker` to find relevant pages
- Improves link quality

### 7.3. Link Suggestions (`.crossref-state/suggestions.json`)

**Type:** JSON array of `LinkSuggestion` objects

**Purpose:**
- Accumulate all suggestions across runs
- Enable manual review of pending suggestions
- Track applied/skipped/pending status
- Support analytics and coverage reporting

## 8. Development & Testing

### 8.1. Local Setup

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Create .env with API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env

# Run tests
npm test

# Watch mode
npm test:watch
```

### 8.2. Testing Framework

**Vitest** — Test runner with snapshot support

**Test Coverage:**
- 19 tests for markdown parsing
- 11 tests for link insertion
- 4 tests for validation
- 9 end-to-end smoke tests

## 9. Configuration & Deployment

### 9.1. Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...  # Required for all workflows
```

### 9.2. Configuration File

`.crossref-config.json` (optional, in parent of docs):

```json
{
  "excludePatterns": ["node_modules"],
  "maxLinksPerPage": 10,
  "confidenceThreshold": "high"
}
```

### 9.3. Deployment

**Typical Usage:**

```bash
# Build index
flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"reindex"}'

# Process incrementally
flue run crossref --target node \
  --payload '{"docsDir":"./docs","mode":"autopilot"}'

# Generate reference docs
flue run write-data-type-ref --target node \
  --payload '{"projectRoot":".","outputPath":"docs/ref.md"}'
```

## 10. Security Considerations

- **Path Traversal:** All paths resolved with `realpathSync`, checked against docs boundary
- **Symlinks:** Followed to real target, then validated within boundary
- **TOCTOU:** Filesystem operations use try-catch (not existence checks)
- **LLM Safety:** Paths/URLs never directly from LLM (computed deterministically)
- **Error Recovery:** Unreadable files skipped with warnings; state only updated if complete

## 11. Limitations & Future Work

### Current Limitations
- State stored locally (no multi-instance coordination)
- Suggestions from LLM cannot be directly overridden
- No conflict detection for overlapping link text

### Future Enhancements
- Incremental reindex (update only changed files)
- Manual suggestion override interface
- Real-time analytics dashboard
- Integration with documentation platforms
- Collaborative review workflows
