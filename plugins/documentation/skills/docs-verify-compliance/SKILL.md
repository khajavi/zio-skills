---
name: docs-verify-compliance
description: >
  Fix compliance issues in a documentation file against writing style and mdoc conventions. 
argument-hint: "[docs-file.md]"
allowed-tools: Bash
---

# Verify Documentation Compliance

## Workflow

Run these commands in order:

```bash
/docs-check-compliance $ARGUMENTS docs-writing-style
/docs-check-compliance $ARGUMENTS docs-mdoc-conventions
sbt "docs/mdoc --in $ARGUMENTS --out website/$ARGUMENTS"
```

Never bare `sbt docs/mdoc` without `--in`/`--out` — it recompiles every doc in the tree instead of just
this one. `--out` is `$ARGUMENTS` prefixed with `website/`, matching where mdoc's output belongs.

Fix all violations identified by `/docs-check-compliance`, committing each separately. Ensure the final mdoc compilation succeeds with zero errors.
