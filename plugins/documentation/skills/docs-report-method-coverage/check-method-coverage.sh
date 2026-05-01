#!/bin/bash
# Documentation coverage checker for ZIO library reference pages.
# Compares extracted data type members against documentation.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check-method-coverage.sh <TypeName> <doc-file.md> [members-file]
   Or: extract-members.scala <Source.scala> <TypeName> | check-method-coverage.sh <TypeName> <doc-file.md>

Cross-checks the public members of a Scala data type (extracted from source
or supplied as a list) against a reference documentation page, and reports
any members that are not documented.

Arguments:
  <TypeName>       Scala type name (e.g., Chunk, Reader, Schema).
  <doc-file.md>    Reference documentation page to audit.
  [members-file]   Optional file with one member name per line,
                   or sections produced by extract-members.scala.
                   If omitted, members are read from stdin.

Options:
  -h, --help       Print this help message and exit.

Exit codes:
  0  Full coverage — every public member is documented.
  1  One or more members are missing from the documentation.
  2  Invocation error (missing arguments, file not found, no input).

Examples:
  check-method-coverage.sh Reader docs/reference/reader.md members.txt
  ./extract-members.scala Reader.scala Reader | check-method-coverage.sh Reader docs/reference/reader.md
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

if [[ $# -lt 2 ]]; then
  echo "Error: expected at least two arguments (<TypeName> <doc-file.md>)" >&2
  usage >&2
  exit 2
fi

TYPE_NAME="$1"
DOC_FILE="$2"
MEMBERS_FILE="${3:-}"

if [[ ! -f "$DOC_FILE" ]]; then
  echo "Error: Documentation file not found: $DOC_FILE" >&2
  exit 2
fi

# Read members from file or stdin
MEMBERS_INPUT=$(mktemp)
trap "rm -f '$MEMBERS_INPUT'" EXIT

if [[ -n "$MEMBERS_FILE" ]]; then
  if [[ ! -f "$MEMBERS_FILE" ]]; then
    echo "Error: Members file not found: $MEMBERS_FILE" >&2
    exit 2
  fi
  cat "$MEMBERS_FILE" > "$MEMBERS_INPUT"
elif [[ ! -t 0 ]]; then
  # Read from stdin if available
  cat > "$MEMBERS_INPUT"
else
  echo "Error: No members input provided (file or stdin)" >&2
  exit 2
fi

if [[ ! -s "$MEMBERS_INPUT" ]]; then
  echo "Error: No members provided" >&2
  exit 2
fi

# Extract documented methods from markdown
# Looks for backtick-enclosed method references like:
# - `methodName` (bare method name)
# - `TypeName#methodName` (instance method)
# - `TypeName.methodName` (companion/static method)
#
# Filters to only method-like patterns:
# - Must start with lowercase (camelCase methods) or be symbolic operators
# - Allow alphanumeric, underscores
# - Excludes type names, constants, keywords, variables, and code tokens
extract_methods_from_doc() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return
  fi

  # Extract all backtick-quoted content
  grep -oE '`[^`]+`' "$file" | \
    sed -E 's/`//g' | \
    # Strip parameter lists and type parameters: remove everything from '(' or '[' onwards
    sed -E 's/[\(\[].*//' | \
    # Extract just the method name if it's Type#method or Type.method format
    sed -E 's/^[^#.]*[#.]//' | \
    # Filter to only method-like identifiers:
    # - Start with lowercase letter (methods are camelCase)
    # - Allow alphanumeric, underscores, symbolic operators
    # - Must be at least 2 characters (exclude single-letter variables)
    grep -E '^[a-z][a-zA-Z0-9_]{1,}$|^[+:*/%&|^!<>@\\-]+$' | \
    # Exclude common keywords and non-method tokens
    grep -vE '^(true|false|null|this|super|self|finally|inline|bufSize|pred|f|n|z|via|nio)$' | \
    sort -u
}

echo "=== Documentation Coverage Check for '$TYPE_NAME' ==="
echo ""

# Prepare temp files
COMPANION_MEMBERS=$(mktemp)
API_MEMBERS=$(mktemp)
INHERITED_MEMBERS=$(mktemp)
DOC_METHODS=$(mktemp)
trap "rm -f '$COMPANION_MEMBERS' '$API_MEMBERS' '$INHERITED_MEMBERS' '$DOC_METHODS'" EXIT

# Parse member input into categories
current_section=""
while IFS= read -r line; do
  line="${line#"${line%%[![:space:]]*}"}"  # trim leading whitespace
  line="${line%"${line##*[![:space:]]}"}"  # trim trailing whitespace

  [[ -z "$line" ]] && continue

  if [[ "$line" =~ ^===.*Companion.*=== ]]; then
    current_section="companion"
  elif [[ "$line" =~ ^===.*Public.*API.*=== ]]; then
    current_section="api"
  elif [[ "$line" =~ ^===.*Inherited.*=== ]]; then
    current_section="inherited"
  elif [[ -n "$current_section" ]]; then
    case "$current_section" in
      companion) echo "$line" >> "$COMPANION_MEMBERS" ;;
      api) echo "$line" >> "$API_MEMBERS" ;;
      inherited) echo "$line" >> "$INHERITED_MEMBERS" ;;
    esac
  fi
done < "$MEMBERS_INPUT"

# Collect documented methods
extract_methods_from_doc "$DOC_FILE" > "$DOC_METHODS"

# Report on each category
has_missing=0

# Check Companion Object Members
if [[ -s "$COMPANION_MEMBERS" ]]; then
  echo "=== Companion Object Members ==="
  wc -l < "$COMPANION_MEMBERS" | xargs echo "Total methods:" | sed 's/^/  /'

  MISSING=$(mktemp)
  trap "rm -f '$MISSING'" EXIT
  comm -23 <(sort "$COMPANION_MEMBERS") "$DOC_METHODS" > "$MISSING" 2>/dev/null || true

  if [[ -s "$MISSING" ]]; then
    echo "  ❌ Missing from documentation:"
    sed 's/^/    /' "$MISSING"
    has_missing=1
  else
    echo "  ✓ All documented"
  fi
  echo ""
  rm -f "$MISSING"
fi

# Check Public API
if [[ -s "$API_MEMBERS" ]]; then
  echo "=== Public API ==="
  wc -l < "$API_MEMBERS" | xargs echo "Total methods:" | sed 's/^/  /'

  MISSING=$(mktemp)
  trap "rm -f '$MISSING'" EXIT
  comm -23 <(sort "$API_MEMBERS") "$DOC_METHODS" > "$MISSING" 2>/dev/null || true

  if [[ -s "$MISSING" ]]; then
    echo "  ❌ Missing from documentation:"
    sed 's/^/    /' "$MISSING"
    has_missing=1
  else
    echo "  ✓ All documented"
  fi
  echo ""
  rm -f "$MISSING"
fi

# Check Inherited Methods
if [[ -s "$INHERITED_MEMBERS" ]]; then
  echo "=== Inherited Methods ==="
  wc -l < "$INHERITED_MEMBERS" | xargs echo "Total methods:" | sed 's/^/  /'

  MISSING=$(mktemp)
  trap "rm -f '$MISSING'" EXIT
  comm -23 <(sort "$INHERITED_MEMBERS") "$DOC_METHODS" > "$MISSING" 2>/dev/null || true

  if [[ -s "$MISSING" ]]; then
    echo "  ⚠ Missing from documentation:"
    sed 's/^/    /' "$MISSING"
    has_missing=1
  else
    echo "  ✓ All documented"
  fi
  echo ""
  rm -f "$MISSING"
fi

# Final summary
echo "=== Coverage Summary ==="
if [[ $has_missing -eq 0 ]]; then
  echo "✓ Complete coverage: all members documented"
  exit 0
else
  echo "❌ Incomplete coverage: some members missing from documentation"
  exit 1
fi
