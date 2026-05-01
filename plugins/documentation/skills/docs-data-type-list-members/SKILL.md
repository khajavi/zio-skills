---
name: docs-data-type-list-members
description: Use when extracting and categorizing public members from a Scala data type for documentation completeness checks.
---

# List Data Type Members

Parses a Scala source file and prints public members of the named type, grouped into sections for easy auditing.

```bash
scala-cli ${CLAUDE_PLUGIN_ROOT}/skills/docs-data-type-list-members/extract-members.scala \
  -- <source-file> [<type-name>]
```

Run with `--help` for the full usage.

**Output sections** (each preceded by a header line ending in `===`):
- **Companion Object Members** — factory methods, utilities, and static operations
- **Public API** — instance methods on the type itself
- **Inherited Methods** — methods from parent classes/traits (when cross-file analysis is available)

Excludes private/protected members and internal helpers.

**Exit codes:**

| Code | Meaning                                                          |
|------|------------------------------------------------------------------|
| `0`  | Success — at least one public member was extracted.              |
| `1`  | No public members found in the file or named type.               |
| `2`  | Invocation error (missing arguments, file not found).            |

Pipe the output into `/docs-report-method-coverage` to check whether all members appear in a reference doc.
