# Metadata Extraction Duplication Analysis

**Identifying and proposing refactoring for duplicate metadata extraction logic**

---

## Executive Summary

The `workflows/phases/process.ts` file contains **nearly identical metadata extraction code in two places**:

1. **Lines 148-190** – Extract metadata for main page being analyzed
2. **Lines 261-320** – Extract metadata for See Also target pages

**Duplication Level:** 90% identical code (~70 lines duplicated)

**Impact:**
- Harder to maintain (bug fixes in one place don't propagate)
- Harder to test (two code paths to test separately)
- Harder to enhance (changes needed in two places)
- Risk of divergence (they might evolve differently)

**Solution:** Extract into a helper function `extractAndUpdateMetadata()`

---

## Duplication Map

### Location 1: Main Page Metadata Extraction
**File:** `workflows/phases/process.ts`  
**Lines:** 148-190  
**Triggered:** When processing each page in batch, if missing description OR keywords

```typescript
if (!hasBothFields) {
  console.log(`[crossref] Extracting missing metadata for ${pageEntry.id}...`);
  try {
    const metadataResult = await session.prompt(
      `Extract metadata from this documentation page.
      
      [... 19 lines of prompt ...]
      `,
      {
        result: v.object({
          description: v.string(),
          keywords: v.array(v.string()),
        })
      }
    );

    const metadata = metadataResult.data;
    const updatedContent = updateFrontmatter(pageContent, metadata);
    fs.writeFileSync(pageEntry.absPath, updatedContent, 'utf-8');
    pageContent = updatedContent;
    pageEntry.description = metadata.description;
    pageEntry.keywords = metadata.keywords;
    console.log(`[crossref] Metadata extracted and written for ${pageEntry.id}`);
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${pageEntry.id}:`, e);
  }
}
```

### Location 2: See Also Target Metadata Extraction
**File:** `workflows/phases/process.ts`  
**Lines:** 261-320  
**Triggered:** For each See Also suggestion, if target missing metadata

```typescript
for (const target of seeAlsoTargets) {
  console.log(`[crossref] Extracting metadata for See Also target: ${target.id}`);
  try {
    const targetContent = fs.readFileSync(target.absPath, 'utf-8');

    const fm = parseFrontmatter(targetContent);
    const hasMetadata =
      fm.description !== null &&
      fm.description !== undefined &&
      typeof fm.description === 'string' &&
      Array.isArray(fm.keywords) &&
      fm.keywords.length > 0;
    if (hasMetadata) {
      target.description = fm.description;
      target.keywords = fm.keywords;
      console.log(`[crossref] Skipping extraction for ${target.id} (metadata already present)`);
      continue;
    }

    const metadataResult = await session.prompt(
      `Extract metadata from this documentation page.
      
      [... 19 lines of prompt ...]
      `,
      {
        result: v.object({
          description: v.string(),
          keywords: v.array(v.string()),
        })
      }
    );
    const metadata = metadataResult.data;
    const updatedContent = updateFrontmatter(targetContent, metadata);
    fs.writeFileSync(target.absPath, updatedContent, 'utf-8');
    target.description = metadata.description;
    target.keywords = metadata.keywords;

    output.suggestions
      .filter(s => s.type === 'see_also' && s.targetId === target.id)
      .forEach(s => s.description = metadata.description);
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${target.id}:`, e);
  }
}
```

---

## Side-by-Side Comparison

### Identical Sections

#### Section 1: LLM Prompt (Lines 152-171 vs 281-300)

**Location 1:**
```typescript
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
```

**Location 2:**
```typescript
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
```

**Difference:** Only the variable names change (`pageEntry`→`target`, `pageContent`→`targetContent`)

#### Section 2: Schema Validation (Lines 172-177 vs 301-306)

Both locations use **identical** schema:
```typescript
{
  result: v.object({
    description: v.string(),
    keywords: v.array(v.string()),
  })
}
```

#### Section 3: File Writing (Lines 181-182 vs 309-310)

**Location 1:**
```typescript
const updatedContent = updateFrontmatter(pageContent, metadata);
fs.writeFileSync(pageEntry.absPath, updatedContent, 'utf-8');
```

**Location 2:**
```typescript
const updatedContent = updateFrontmatter(targetContent, metadata);
fs.writeFileSync(target.absPath, updatedContent, 'utf-8');
```

**Difference:** Again, just variable names

#### Section 4: State Update (Lines 183-185 vs 311-312)

**Location 1:**
```typescript
pageContent = updatedContent;
pageEntry.description = metadata.description;
pageEntry.keywords = metadata.keywords;
```

**Location 2:**
```typescript
target.description = metadata.description;
target.keywords = metadata.keywords;
```

**Difference:** Location 1 also updates `pageContent` variable

---

## Differences Between Locations

### Unique to Location 1 (Main page)

1. **Metadata check before extraction** (lines 142-147):
   ```typescript
   const hasBothFields = /* check if description AND keywords exist */
   if (!hasBothFields) { /* extract */ }
   ```

2. **pageContent reassignment after write** (line 183):
   ```typescript
   pageContent = updatedContent;
   ```
   This is necessary because the main page content is used later in the agent prompt.

### Unique to Location 2 (See Also targets)

1. **Loop iteration** (line 261):
   ```typescript
   for (const target of seeAlsoTargets) { /* extract for each target */ }
   ```

2. **Metadata check with logging** (lines 266-278):
   ```typescript
   const hasMetadata = /* check both fields exist */
   if (hasMetadata) {
     target.description = fm.description;
     target.keywords = fm.keywords;
     console.log(`[crossref] Skipping extraction for ${target.id}...`);
     continue;
   }
   ```

3. **Suggestion enrichment** (lines 314-316):
   ```typescript
   output.suggestions
     .filter(s => s.type === 'see_also' && s.targetId === target.id)
     .forEach(s => s.description = metadata.description);
   ```
   This updates the suggestion object with the extracted description.

---

## Refactoring Proposal

### Option 1: Extract Helper Function (Recommended)

Create a helper function that encapsulates the core extraction logic:

```typescript
/**
 * Extract metadata (description + keywords) from a documentation page.
 * If metadata already present in frontmatter, use cached version.
 * Otherwise, invoke LLM to extract and write updated frontmatter to disk.
 * 
 * @param entry - Page index entry (has absPath, id, title)
 * @param content - Current page content
 * @param session - FlueSession for LLM calls
 * @returns { metadata, updatedContent }
 */
async function extractMetadata(
  entry: { id: string; title: string; path: string; absPath: string },
  content: string,
  session: FlueSession,
  options?: { skipWrite?: boolean; skipContentReturn?: boolean }
): Promise<{
  metadata: { description: string; keywords: string[] };
  updatedContent: string;
}> {
  const fm = parseFrontmatter(content);
  const hasMetadata =
    fm.description !== null &&
    fm.description !== undefined &&
    typeof fm.description === 'string' &&
    Array.isArray(fm.keywords) &&
    fm.keywords.length > 0;

  if (hasMetadata) {
    return {
      metadata: { description: fm.description, keywords: fm.keywords },
      updatedContent: content,
    };
  }

  console.log(`[crossref] Extracting metadata for ${entry.id}...`);
  
  const metadataResult = await session.prompt(
    buildMetadataExtractionPrompt(entry.title, entry.path, content),
    {
      result: v.object({
        description: v.string(),
        keywords: v.array(v.string()),
      })
    }
  );

  const metadata = metadataResult.data;
  const updatedContent = updateFrontmatter(content, metadata);
  
  if (!options?.skipWrite) {
    fs.writeFileSync(entry.absPath, updatedContent, 'utf-8');
  }

  console.log(`[crossref] Metadata extracted for ${entry.id}`);
  
  return { metadata, updatedContent };
}

/**
 * Build the LLM prompt for metadata extraction.
 * Extracted to avoid duplication of prompt text.
 */
function buildMetadataExtractionPrompt(title: string, path: string, content: string): string {
  return `Extract metadata from this documentation page.

Page title: ${title}
Page path: ${path}

Content:
${content}

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
- Focus on what users would search for`;
}
```

### Usage Location 1 (Main page)

**Before (43 lines):**
```typescript
if (!hasBothFields) {
  console.log(`[crossref] Extracting missing metadata for ${pageEntry.id}...`);
  try {
    const metadataResult = await session.prompt(
      `Extract metadata from this documentation page.
      [... 19 lines ...]`,
      { result: v.object({ description: v.string(), keywords: v.array(v.string()) }) }
    );
    const metadata = metadataResult.data;
    const updatedContent = updateFrontmatter(pageContent, metadata);
    fs.writeFileSync(pageEntry.absPath, updatedContent, 'utf-8');
    pageContent = updatedContent;
    pageEntry.description = metadata.description;
    pageEntry.keywords = metadata.keywords;
    console.log(`[crossref] Metadata extracted and written for ${pageEntry.id}`);
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${pageEntry.id}:`, e);
  }
}
```

**After (7 lines):**
```typescript
if (!hasBothFields) {
  try {
    const result = await extractMetadata(pageEntry, pageContent, session);
    pageContent = result.updatedContent;
    pageEntry.description = result.metadata.description;
    pageEntry.keywords = result.metadata.keywords;
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${pageEntry.id}:`, e);
  }
}
```

**Savings:** 36 lines removed, 82% reduction

### Usage Location 2 (See Also targets)

**Before (67 lines):**
```typescript
for (const target of seeAlsoTargets) {
  console.log(`[crossref] Extracting metadata for See Also target: ${target.id}`);
  try {
    const targetContent = fs.readFileSync(target.absPath, 'utf-8');
    const fm = parseFrontmatter(targetContent);
    const hasMetadata = /* ... check ... */;
    if (hasMetadata) {
      target.description = fm.description;
      target.keywords = fm.keywords;
      console.log(`[crossref] Skipping extraction for ${target.id} (metadata already present)`);
      continue;
    }

    const metadataResult = await session.prompt(
      `Extract metadata from this documentation page.
      [... 19 lines ...]`,
      { result: v.object({ description: v.string(), keywords: v.array(v.string()) }) }
    );
    const metadata = metadataResult.data;
    const updatedContent = updateFrontmatter(targetContent, metadata);
    fs.writeFileSync(target.absPath, updatedContent, 'utf-8');
    target.description = metadata.description;
    target.keywords = metadata.keywords;

    output.suggestions
      .filter(s => s.type === 'see_also' && s.targetId === target.id)
      .forEach(s => s.description = metadata.description);
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${target.id}:`, e);
  }
}
```

**After (12 lines):**
```typescript
for (const target of seeAlsoTargets) {
  try {
    const result = await extractMetadata(target, fs.readFileSync(target.absPath, 'utf-8'), session);
    target.description = result.metadata.description;
    target.keywords = result.metadata.keywords;

    output.suggestions
      .filter(s => s.type === 'see_also' && s.targetId === target.id)
      .forEach(s => s.description = result.metadata.description);
  } catch (e) {
    console.warn(`[crossref] Failed to extract metadata for ${target.id}:`, e);
  }
}
```

**Savings:** 55 lines removed, 82% reduction

---

## Implementation Impact

### Benefits

1. **DRY Principle** – One source of truth for metadata extraction logic
2. **Maintainability** – Changes to extraction logic only need to happen once
3. **Testability** – Can test `extractMetadata()` function independently
4. **Consistency** – Both code paths use identical logic, no divergence risk
5. **Reduced LOC** – 91 lines reduced to 19 (79% reduction)

### Risks

1. **Behavior Change** – Need to ensure refactored code behaves identically
2. **Error Handling** – Both locations have try/catch, ensure they still catch properly
3. **Side Effects** – Location 1 updates `pageContent` variable; Location 2 updates suggestions

### Testing Strategy

1. Create unit tests for `extractMetadata()`:
   - Test with metadata already present (should return cached)
   - Test with missing metadata (should invoke LLM)
   - Test file write behavior
   
2. Create integration tests:
   - Run full process.ts workflow
   - Verify main page metadata extracted
   - Verify See Also target metadata extracted
   - Verify suggestions enriched with descriptions

---

## Code Quality Metrics

### Before Refactoring

```
Lines of metadata extraction code:  91
Duplication level:                  90%
Unique logic sections:              2
Test complexity:                    Medium (multiple code paths)
```

### After Refactoring

```
Lines of extraction logic:          19 (helper function)
Lines in calling code:              19 (both locations combined)
Duplication level:                  0%
Unique logic sections:              1
Test complexity:                    Low (single tested function)
```

---

## Recommendation Priority

**Priority:** HIGH

**Rationale:**
- High duplication (90%)
- High code smell (similar code should be unified)
- Moderate effort (1-2 hours)
- High benefit (easier maintenance, fewer bugs)
- Low risk (pure refactoring, no behavior change)

**Implementation Effort:** ~1-2 hours
- Extract helper function: 30 min
- Update both call sites: 20 min
- Create unit tests: 30 min
- Integration test: 20 min
- Code review: 10 min

---

## Files Affected

- `workflows/phases/process.ts` – Main file requiring refactoring
- `tools/` – May need to export helper if desired
- `tests/workflow-smoke.test.ts` – Existing tests should still pass

---

## See Also

- EXECUTION_TRACE_ANALYSIS.md – Documents metadata extraction behavior
- ARCHITECTURE.md – Documents intended metadata extraction flow
- PHASE_ANALYSIS_SUMMARY.md – Finding #3 mentions metadata extraction costs

