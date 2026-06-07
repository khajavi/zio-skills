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

### Verify Documentation Builds

To validate that the documentation builds successfully after cross-reference additions:

```bash
npx flue run crossref --target node \
  --payload '{"docsDir":"/path/to/docs","mode":"verify"}'
```

**Parameters:**
- `docsDir`: Absolute path to the docs directory

The verify mode automatically detects the build system (Docusaurus, MkDocs, or Sphinx) and runs the build command. Use this after running `autopilot` mode to ensure no broken links were introduced.

### Auto-Fix Documentation Build Failures

To automatically fix build failures and re-validate:

```bash
npx flue run crossref --target node \
  --payload '{
    "docsDir":"/path/to/docs",
    "mode":"verify-and-fix",
    "maxRetries":3
  }'
```

**Parameters:**
- `docsDir`: Absolute path to the docs directory
- `mode`: "verify-and-fix" to enable auto-fixing
- `maxRetries`: Maximum number of fix attempts (default: 3, optional)

**How it works:**
1. Verifies documentation builds
2. If build fails: extracts errors (broken links, syntax errors, missing files)
3. Fixes documentation using Claude analysis
4. Re-verifies build
5. Repeats until success or max retries exceeded

**Automatic fixes include:**
- Adding missing `.md` extensions to links
- Correcting relative paths
- Closing unclosed code fences
- Removing broken file references

Use this mode to automatically resolve common documentation build issues without manual intervention.

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
