---
name: docs-report-method-coverage
description: Use when checking if documentation covers all public members of a Scala data type.
---

# Report Method Coverage

Cross-checks the public members of a Scala data type against a reference doc page and reports any members that are not documented.

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-report-method-coverage/check-method-coverage.sh \
  <TypeName> <doc-file.md> [members-file]
```

Members may be supplied via `[members-file]` or piped on stdin (typically from `/docs-data-type-list-members`):

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-data-type-list-members/extract-members.scala Reader.scala Reader \
  | bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-report-method-coverage/check-method-coverage.sh \
      Reader docs/reference/reader.md
```

Run the script with `--help` for the full usage.

**Exit codes:**

| Code | Meaning                                                              |
|------|----------------------------------------------------------------------|
| `0`  | Full coverage — every public member is documented.                   |
| `1`  | One or more members are missing from the documentation.              |
| `2`  | Invocation error (missing arguments, file not found, no input).      |

## JSON Output

For machine-readable output (e.g., CI gates, downstream filtering with `jq`), pass `--json`:

```bash
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-report-method-coverage/check-method-coverage.sh \
  --json Reader docs/reference/reader.md members.txt | jq '.fullCoverage'
```

JSON schema:

```json
{
  "typeName":    "Reader",
  "docFile":     "docs/reference/reader.md",
  "categories": {
    "companion": { "total": 5, "documented": 4, "missing": ["foo"] },
    "publicApi": { "total": 12, "documented": 12, "missing": [] }
  },
  "fullCoverage": false
}
```

Categories with no input members are omitted from the `categories` object. Exit codes are unchanged in JSON mode.
