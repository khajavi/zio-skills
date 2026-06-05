---
name: cross-linker
description: >
  Identify cross-linking opportunities in docs pages. Suggest inline links and
  "See Also" refs. Use when analyzing markdown for improved navigation.
tags: [documentation, linking, cross-reference, zio, agent-skills]
---

# Cross Linker Skill

Documentation cross-linking specialist. Identify where pages should link to each other.

## Input

Receive:
- **JSON index** - All pages (id, title, path)
- **Target page** - Full content to analyze
- **Adjacent pages** - Same section/directory
- **Helper tools** - Verify details, find related pages

## Task Flow

**CRITICAL: Metadata FIRST**

**Phase 1:** Extract metadata (call alone first). (MANDATORY)
   1. Check target page YAML frontmatter
   2. Missing `description` OR `keywords`? Call `extract_page_metadata` alone (sequential, not parallel)
   3. Wait for complete

**Phase 2:** Identify refs
1. **Inline links** - Sentence mentions concept that another page covers
2. **See Also** - Strongly related but not inline mentioned. PRIORITIZE adjacent pages

## Anchor Text

Pick shortest phrase (1-5 words):
- Appears exact in document
- Clear, standalone concept ("Exit", "ZLayer", "ZStream")
- Reads natural
- PREFER first occurrence

Rules:
- Inline links: match doc capitalization exactly
- See Also: Title Case ("Fiber", "Resource Management")
- Prose only (NOT headings/code blocks)
- Validate with `search_page_content`

Valid: "Exit" from "Exit value that the Scope is closed with"
Valid: "ZLayer" from "scoped resource into a ZLayer for..."
Bad: "Exit value that the Scope" (too long)
Bad: "Using a Scope" from heading (use prose)

Before finalizing:
1. `search_page_content` verify anchor exists in prose
2. Complete word (not "Ref" inside "careful")
3. Earliest occurrence preferred
4. NOT in heading/code/frontmatter

## See Also Links

Format: `- [Term](./path.md) — brief description`

Description REQUIRED always.

Requirements:
- 5-15 words why related
- Examples: "Fiber management, core to ScopedRef" / "Base ref type without resource mgmt" / "Cancellation model for concurrent ops" / "Resource acquisition & lifecycle"
- Same section? Mention relevance
- From code? Explain code concept

Strategy:
- **ALWAYS adjacent pages** (same section = technically relevant by design)
  - No inline mention needed—location makes them relevant
  - Creates natural nav mesh
- **Non-adjacent:** Only if meaningfully discussed OR clearly relevant
- Quality first: no dupes, no self-links, respect existing links

Adjacent recognition:
- Same section/directory
- ALWAYS HIGH confidence (relevant by proximity)
- Content mentions related concept? Link even if passing mention

From code blocks:
- Code reveals related concepts
- Inline links use prose; See Also can reference code
- Example: `ZIO.acquireRelease` -> suggest resource mgmt pages
- Identifiers like `forkScoped`, `FiberRef.make`, `ZIO.scoped` = valuable clues
- Link to pages explaining patterns (resource acq, fiber mgmt)

## Confidence

HIGH:
- Central to page (title/intro/headings) OR
- First mention OR
- Adjacent pages (always HIGH—relevant by proximity)

MEDIUM:
- Dedicated section OR multiple mentions (non-adjacent only)

LOW:
- Passing mention OR tangential (non-adjacent only)

## Helper Tools

Optional. Use to verify or find related pages. Most decisions from content + index alone.

**search_pages** - Query index by title/keywords/topic. Top 5 matches.
- When: Find topic pages without manual browse
- Ex: "config pages" → 5 most relevant

**extract_page_metadata** - MANDATORY if incomplete. Extract description & keywords, update frontmatter.
- Call if: `description` OR `keywords` (or both) MISSING
- Skip if: BOTH exist already
- Ex: `id: foo, title: "Foo"` → MUST call
- Auto-writes to frontmatter, returns `source: "extracted_and_written"` or `"state_cache"`

**search_page_content** - Find terms in page. Context snippets with line numbers. FOR ANCHOR VALIDATION.
- When: BEFORE finalizing anchor—verify phrase exists in prose
- Critical: "Ref" complete word (not in "careful")?
- Critical: "Scope" in prose (not heading)?
- Optional: Verify concept discussed before linking
- Ex: "Where's ZIO.acquireRelease?" → snippets + line numbers

**validate_anchor** - Check if anchor/heading exists. Returns available headings.
- When: Linking method/operator names needing anchors
- Ex: "Runtime.setConfigProvider heading?" → check first

**extract_page_structure** - Get full heading structure (TOC).
- When: Understand page org before See Also
- Ex: "What sections?"

**get_adjacent_pages** - All pages in same section. Good See Also candidates.
- When: Find same-topic pages
- Ex: "Other ZStream pages in section?"

## Errors

Tool fails/empty results:
- **extract_page_metadata fails:** Continue. Flag missing metadata in reasoning.
- **search_pages empty:** Skip. Use index alone.
- **search_page_content no anchor:** Don't suggest. Find different phrase or skip.
- **Page unreadable:** Skip links to it. Report in reasoning if critical.

## Rules

- MANDATORY: `extract_page_metadata` if missing `description` or `keywords`. NOT optional.
- No self-links
- No existing links
- Max 10 total suggestions (maxLinksPerPage) but don't pad with unrelated to hit limit
- Quality > quantity. 3 high-confidence beats 10 speculative.

## Goal

Find high-quality cross-refs helping readers navigate docs.

Prioritize:
1. Quality > quantity (5 great beats 10 mediocre)
2. Adjacent pages first (always relevant by proximity)
3. Exact matches (anchor text exists in doc)
4. Short phrases (1-3 words ideal)
5. First mentions (link where readers first encounter)

## Output

JSON only. No markdown/explanation.

```json
{
  "suggestions": [
    {
      "targetId": "id from index",
      "targetTitle": "string",
      "anchorText": "1-5 words, EXACT from doc",
      "description": "REQUIRED for see_also; optional for inline",
      "type": "inline | see_also",
      "confidence": "high | medium | low",
      "reasoning": "one sentence"
    }
  ]
}
```

CRITICAL: Every see_also MUST have description. Skipped if missing. Inline description optional but recommended.

