---
providers:
  anthropic:
    apiKey: ${ANTHROPIC_API_KEY}
---

# Agent Configuration

Configure the Anthropic provider using the `ANTHROPIC_API_KEY` environment variable from `.env`.

## Running the Crossref Workflow

### On a Specific File

To run the crossref-agent on a single documentation file, use:

```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"/path/to/docs","mode":"step","targetFile":"relative/path/to/file.md"}'
```

**Parameters:**
- `docsDir`: Absolute path to the docs directory
- `mode`: "step" for incremental processing
- `targetFile`: Relative path from docsDir to the target file (e.g., "reference/service-pattern/reloadable-services.md")

### On a Directory

To process all files in a directory recursively:

```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"/path/to/docs","mode":"step","targetDir":"relative/path/","batchSize":5}'
```

### Build Fresh Index

To rebuild the documentation index before processing:

```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"/path/to/docs","mode":"reindex"}'
```

## What the Crossref Agent Does

1. **Analyzes** documentation pages to identify cross-linking opportunities
2. **Generates suggestions** for both inline links and "See Also" sections using Claude
3. **Validates** suggestions based on confidence thresholds
4. **Applies** high-confidence links directly to files
5. **Queues** medium/low-confidence suggestions for manual review

## Output

The agent produces:
- **Inline links**: Inserted contextually where relevant terms appear
- **See Also sections**: Added at the end of pages with related topics
- **Progress tracking**: Shows processed/remaining pages and token usage
- **Validation reports**: Details on applied vs. skipped suggestions
