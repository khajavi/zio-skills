---
name: docs-research
description: Shared research procedure for documentation skills. Find source files, tests, examples, patterns, and GitHub history when researching a topic. Used by docs-how-to-guide, docs-tutorial, and docs-data-type-ref.
allowed-tools: Read, Glob, Grep, Bash(gh:*), Bash(sbt:*)
---

# Source Code Research for Documentation

Use this procedure when researching a topic to understand the complete landscape of types, methods, patterns, and integrations before writing documentation.

## Step 1a: Identify Core Source Files

Based on the topic/type name, identify which library data types or concepts are central. Use Glob and Grep to find their source files:

```
Glob: **/src/main/scala*/**/<TypeName>.scala
Grep: "class <TypeName>" or "trait <TypeName>" or "object <TypeName>"
```

For each core type:

1. **Read the full source file** — understand every public method, type parameter, companion object, and factory method.
2. **Read existing documentation** — check `docs/reference/` and `docs/` for any existing page. Understand what is already documented vs. what you need to explain.
3. **Read the tests** — search `*/src/test/scala/` for test files. Tests reveal idiomatic usage patterns, edge cases, and realistic examples to mirror in your documentation.

## Step 1b: Identify Supporting Types and Concepts

Beyond the core types, find every supporting type that readers will encounter:

1. **Grep for imports** in test files related to the core types — these reveal the full dependency graph.
2. **Trace the type signatures** — if a core method returns `Result[String, A]`, then `Result` is a supporting type to understand.
3. **Find implicit instances and type class derivation** — identify what derives automatically vs. must be created manually.

For each supporting type, read enough of its source and docs to explain it concisely in context (you do not need to be exhaustive—just what serves your documentation goal).

## Step 1c: Find Real-World Patterns

Search for realistic usage patterns:

1. **Examples directory**: Glob for `**/examples/**/*.scala` and read any examples related to the topic.
2. **Test suites**: The best source of idiomatic code. Look for integration tests that combine multiple types.
3. **Cross-module usages**: Grep for how core types are used across different modules—this reveals integration patterns.

## Step 1d: Search GitHub History

Use the GitHub CLI (`gh`, available in every project) to search issues, pull requests, and discussions related to the topic. The goal is to surface:

- Design decisions and rationale behind the APIs involved
- Known caveats, gotchas, or non-obvious behavior raised in issues
- Common user questions, pain points, or misconceptions to address
- Real-world use cases shared by contributors
- Concrete examples or idioms mentioned in discussions

**Default queries:**

```bash
# Closed issues and PRs that mention the topic (most informative)
gh issue list  --repo <owner>/<repo> --state all --search "<topic>"      --limit 30
gh pr    list  --repo <owner>/<repo> --state all --search "<topic>"      --limit 30

# Code search across the repo for usage patterns
gh search code --repo <owner>/<repo> "<topic>"                            --limit 20
```

Run multiple queries — vary the topic, type names, and related feature keywords for thorough coverage. Read the bodies of the most-commented issues/PRs (`gh issue view <n> --comments`) to capture the discussion, not just the title.

**Project-specific helpers (optional):** some ZIO projects ship an sbt task that wraps these queries with richer formatting (e.g., `sbt "gh-query --verbose <topic>"` in zio-blocks). Use it if it exists in the project's `build.sbt`; otherwise fall back to the `gh` commands above.

---

## Design Rule

This sub-skill targets ≤80 lines and covers the shared research procedure only. Document-specific research questions (which differ between guides, tutorials, and references) should remain in the parent skill.
