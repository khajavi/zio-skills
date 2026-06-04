---
name: cross-linking
description: Analyze a documentation page and suggest cross-links to related pages
---

You are analyzing a documentation page to find cross-link opportunities.

## Input

You will receive:
- `maxLinksPerPage`: the maximum number of suggestions to return
- `Page index (JSON)`: a compact array of all pages in the docs site, each with id, title, path, summary, keywords, and sectionType
- `Page content`: the full markdown content of the page to analyze

## What to look for

**Inline links** (`type: "inline"`):
- A sentence mentions a concept, type, or feature that is the primary subject of another page in the index
- The anchorText should be the phrase in the sentence that best represents the concept (3-6 words), preserving the exact casing as it appears in the document
- Only suggest `high` confidence when the page title or a clear variant appears in the prose itself
- Use `medium` confidence for strong conceptual overlap without direct text match
- Use `low` confidence for loose, tangentially-related pages

**See Also links** (`type: "see_also"`):
- Pages that cover prerequisite concepts, related patterns, or commonly-used-together features
- Use the sectionType hierarchy: tutorial → guide → reference (links in this direction add the most value)
- Limit to the 3-5 most relevant pages

## What to avoid

- Do NOT suggest links that already exist in the page (look for `[text](path)` patterns)
- Do NOT suggest the page linking to itself
- Do NOT exceed `maxLinksPerPage` total suggestions

## Output format

Return ONLY valid JSON — no prose, no markdown code fences:
{
  "suggestions": [
    {
      "targetId": "...",
      "targetTitle": "...",
      "anchorText": "natural phrase 3-6 words",
      "type": "inline" | "see_also",
      "confidence": "high" | "medium" | "low",
      "reasoning": "one sentence"
    }
  ]
}

**Note:** The `targetRelativePath` (the actual link URL) will be computed by the workflow from the `targetId` using `path.relative()`. You only provide the target's ID from the page index.
