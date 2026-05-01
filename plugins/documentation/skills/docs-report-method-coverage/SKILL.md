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
