---
name: docs-reduce-redundancy
description: Remove redundant content from documentation. Use when sections repeat information unnecessarily, type definitions appear multiple times, concepts are introduced more than once, or transition words clutter meaning. Reduces cognitive load through deduplication and strategic cross-referencing.
argument-hint: "[path/to/doc.md]"
allowed-tools: Read, Edit, Bash, Grep
---

# Reduce Redundancy from Documentation

## Overview

Redundancy slows readers down by forcing them to process repeated information. Documentation should express each concept exactly once, use each phrase once, and remove unnecessary transition words that don't guide meaning. This skill helps identify and fix three types of redundancy: **lexical** (repeated words/phrases), **structural** (unnecessary transitions), and **semantic** (repeated concepts across sections).

## Agent Workflow

**Phase 1 — Scanning (no edits)**

1. Read the full document
2. Use the Redundancy Detection Guide below to identify violations
3. Create one task per redundancy found:
   - `"Remove redundancy – section:<name> (Type: <lexical|structural|semantic>): <description>"`
4. List all tasks for user confirmation before editing

**Phase 2 — Execution**

1. For each task, apply the appropriate fix strategy (see Fixing Strategies table)
2. When removing a repeated definition, add a cross-reference (link) instead
3. Preserve all meaning—remove only unnecessary words
4. Mark each task `completed` as you finish

**Phase 3 — Verification**

After all tasks complete, compile the documentation:
```
sbt "docs/mdoc --in <file.md>"
```

Verify:
- No compilation errors
- Cross-references are valid (no broken links)
- Sections flow naturally after cuts
- Concept clarity is preserved

## Redundancy Detection Guide

| Type | How to Identify | Signal | Example |
|------|-----------------|--------|---------|
| **Lexical** | Word appears 2+ times in same/adjacent sentences where only one is needed | Synonym appears nearby; removing word keeps meaning intact | "return back", "free gift", "unexpected surprise" |
| **Lexical** | Same phrase repeats in consecutive paragraphs | Copy-paste patterns; look for identical 3+ word phrases | Same code snippet introduced identically twice |
| **Structural** | Transition words that don't clarify sequence or relationship | Removing "furthermore", "also", "in particular" leaves meaning clear | "Furthermore, also," (both signal addition); "In this regard," when context is obvious |
| **Structural** | Signposting phrase that restates what was just said | Phrase like "as mentioned above" or "as we discussed" | "We showed earlier that X works. As mentioned above, X is useful." |
| **Semantic** | Type defined or explained in 2+ places | Same definition appears in different sections; same type signature shown multiple times | "`Chunk` is an immutable sequence" appears in Overview, Use Cases, and API section |
| **Semantic** | Example pattern repeats across sections | Same use-case explained with similar code/narrative structure | Multiple "hello world" examples in consecutive sections |
| **Semantic** | Motivation explained more than once | Concept justified in intro, then justified again later | "We need deduplication for performance" appears in both Overview and Benefits |

## Fixing Strategies

Apply the appropriate strategy based on redundancy type:

| Redundancy | Strategy | Example |
|-----------|----------|---------|
| **Lexical: synonym nearby** | Remove the redundant word; keep one | Change "return back" → "return" |
| **Lexical: phrase repeats** | Extract to section intro or single location; use cross-reference | Define once at top; link from repeated locations |
| **Structural: unnecessary transition** | Delete transition word; verify sentence still flows | Delete "Furthermore,"; sentence should still read naturally |
| **Structural: restated signposting** | Remove phrase; rely on document flow | Delete "As mentioned above," — reader can infer from prior section |
| **Semantic: repeated definition** | Keep definition in primary location (earliest, or most prominent); replace repeats with `[See X](#link)` | First definition in Overview; later sections link to it |
| **Semantic: repeated example** | Choose the best/clearest example; remove others; add comparative note if examples show different patterns | Keep one realistic example; remove toy examples |
| **Semantic: repeated motivation** | Keep motivation in one place (usually intro); remove from later sections | Explain "why" once; don't repeat in each section |

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|-------------|-----|
| Over-aggressive cutting | Removing context leaves section unclear | Remove only redundancy; preserve concept explanations |
| Cutting example entirely | Readers need at least one concrete example | Keep best example; remove duplicates, not all examples |
| Removing type definition completely | Later sections may reference it without context | Always keep definition in first/primary location; link from others |
| Breaking cross-references | Links become invalid after moving content | Verify links after removing redundant sections |
| Removing transitions that clarify logic | Some transitions guide meaning ("first", "then", "because") | Only remove decorative transitions ("furthermore", "also") |
| Cutting without re-reading | Section becomes grammatically broken | Always read edited section aloud after cutting |

## Detection Hints

- **Grep for repeated phrases**: `grep -n "<phrase>" <file.md>` to find all occurrences
- **Read for transitions**: Scan for words: "also", "furthermore", "moreover", "in addition", "as mentioned", "as we discussed", "in this regard"
- **Count type mentions**: Each type should have at most one full definition; others should cross-reference
- **Scan for patterns**: Look for identical code structures or narrative patterns in consecutive examples

## Integration

After completing this skill, the document is ready for:
- **Stylistic review**: Use `/docs-writing-style` to check prose rules
- **Compliance check**: Use `/docs-check-compliance` to audit against all rules
- **Integration**: Use `/docs-integrate` if adding the document to the site
