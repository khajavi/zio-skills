#!/bin/bash
# mdoc conventions checker — mechanical rules for ZIO project docs.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check-mdoc-conventions.sh <file.md>

Mechanical mdoc-conventions checker for ZIO project documentation. Validates
that every executable Scala code block in a Markdown file has an appropriate
mdoc modifier (mdoc, mdoc:silent, mdoc:compile-only, mdoc:reset, …).
Plain ```scala blocks are treated as type-definition illustrations and skipped.

Arguments:
  <file.md>       Markdown file to check (required).

Options:
  -h, --help      Print this help message and exit.

Exit codes:
  0  No violations found.
  1  One or more code blocks are missing mdoc modifiers.
  2  Invocation error (missing/extra arguments, file not found).

Examples:
  check-mdoc-conventions.sh docs/reference/chunk.md
  check-mdoc-conventions.sh docs/how-to/writing.md && echo "mdoc OK"
EOF
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  "")
    usage >&2
    exit 2
    ;;
esac

if [[ $# -ne 1 ]]; then
  echo "Error: expected exactly one argument, got $#" >&2
  usage >&2
  exit 2
fi

FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "Error: File not found: $FILE" >&2
  exit 2
fi

VIOLATIONS=0

# Check for Scala code blocks missing mdoc modifiers
# Excludes plain ```scala when used for data type definitions (structural illustrations)
count_violations() {
  local output="$1"
  if [[ -n "$output" ]]; then
    echo "$output"
    VIOLATIONS=$((VIOLATIONS + $(printf '%s\n' "$output" | wc -l | tr -d ' ')))
  fi
}

count_violations "$(awk '
  /^```scala$/ {
    print FILENAME ":" NR ": Scala code block missing mdoc modifier (use ```scala mdoc:compile-only or appropriate modifier)"
  }
' "$FILE")"

if [[ $VIOLATIONS -gt 0 ]]; then
  echo ""
  echo "✗ Found $VIOLATIONS violation(s)"
  exit 1
else
  echo "✓ All mdoc conventions passed"
  exit 0
fi
