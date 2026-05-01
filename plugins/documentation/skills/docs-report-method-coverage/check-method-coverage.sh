#!/bin/bash
# Documentation coverage checker for ZIO library reference pages.
# Compares extracted data type members against documentation.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: check-method-coverage.sh [--json] <TypeName> <doc-file.md> [members-file]
   Or: extract-members.scala <Source.scala> <TypeName> | check-method-coverage.sh [--json] <TypeName> <doc-file.md>

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
  --json           Emit machine-readable JSON instead of the default human
                   report. Schema:
                     {
                       "typeName":    "<TypeName>",
                       "docFile":     "<path>",
                       "categories": {
                         "companion": { "total": N, "documented": N, "missing": [...] },
                         "publicApi": { "total": N, "documented": N, "missing": [...] },
                         "inherited": { "total": N, "documented": N, "missing": [...] }
                       },
                       "fullCoverage": true|false
                     }
                   Categories with no input members are omitted.
  -h, --help       Print this help message and exit.

Exit codes:
  0  Full coverage — every public member is documented.
  1  One or more members are missing from the documentation.
  2  Invocation error (missing arguments, file not found, no input).

Examples:
  check-method-coverage.sh Reader docs/reference/reader.md members.txt
  ./extract-members.scala Reader.scala Reader | check-method-coverage.sh Reader docs/reference/reader.md
  ./extract-members.scala Reader.scala Reader \
    | check-method-coverage.sh --json Reader docs/reference/reader.md \
    | jq '.categories.publicApi.missing'
EOF
}

# Filter --json out of positional argument list.
JSON_OUTPUT=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --json) JSON_OUTPUT=1 ;;
    -h|--help)
      usage
      exit 0
      ;;
    *) ARGS+=("$arg") ;;
  esac
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 2
fi

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

if [[ $JSON_OUTPUT -eq 0 ]]; then
  echo "=== Documentation Coverage Check for '$TYPE_NAME' ==="
  echo ""
fi

# Prepare temp files
COMPANION_MEMBERS=$(mktemp)
API_MEMBERS=$(mktemp)
INHERITED_MEMBERS=$(mktemp)
DOC_METHODS=$(mktemp)
COMPANION_MISSING=$(mktemp)
API_MISSING=$(mktemp)
INHERITED_MISSING=$(mktemp)
trap "rm -f '$COMPANION_MEMBERS' '$API_MEMBERS' '$INHERITED_MEMBERS' '$DOC_METHODS' '$COMPANION_MISSING' '$API_MISSING' '$INHERITED_MISSING'" EXIT

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

# Compute missing-set per category (drives both text and JSON output)
[[ -s "$COMPANION_MEMBERS" ]] && comm -23 <(sort "$COMPANION_MEMBERS") "$DOC_METHODS" > "$COMPANION_MISSING" 2>/dev/null || true
[[ -s "$API_MEMBERS"       ]] && comm -23 <(sort "$API_MEMBERS")       "$DOC_METHODS" > "$API_MISSING"       2>/dev/null || true
[[ -s "$INHERITED_MEMBERS" ]] && comm -23 <(sort "$INHERITED_MEMBERS") "$DOC_METHODS" > "$INHERITED_MISSING" 2>/dev/null || true

has_missing=0
[[ -s "$COMPANION_MISSING" ]] && has_missing=1
[[ -s "$API_MISSING"       ]] && has_missing=1
[[ -s "$INHERITED_MISSING" ]] && has_missing=1

# ─── Output ───────────────────────────────────────────────────────────────────

if [[ $JSON_OUTPUT -eq 1 ]]; then
  # JSON output: build a single object using the awk JSON encoder below.
  json_array_from_file() {
    # Emits a JSON array of strings, one per line of $1; missing/empty file → "[]"
    local f="$1"
    if [[ ! -s "$f" ]]; then
      printf '[]'
      return
    fi
    awk 'BEGIN { printf "[" }
      {
        gsub(/\\/, "\\\\")
        gsub(/"/,  "\\\"")
        gsub(/\b/, "\\b"); gsub(/\f/, "\\f")
        gsub(/\n/, "\\n"); gsub(/\r/, "\\r"); gsub(/\t/, "\\t")
        if (NR > 1) printf ","
        printf "\"%s\"", $0
      }
      END { printf "]" }' "$f"
  }
  json_string() {
    # JSON-escape a single string and wrap in quotes.
    printf '"%s"' "$(printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g')"
  }

  count_lines() {
    # Always print an integer (0 if file missing/empty).
    if [[ -s "$1" ]]; then wc -l < "$1" | tr -d ' '; else printf 0; fi
  }

  comp_total=$(count_lines "$COMPANION_MEMBERS")
  api_total=$(count_lines "$API_MEMBERS")
  inh_total=$(count_lines "$INHERITED_MEMBERS")
  comp_miss_count=$(count_lines "$COMPANION_MISSING")
  api_miss_count=$(count_lines "$API_MISSING")
  inh_miss_count=$(count_lines "$INHERITED_MISSING")

  # Emit a single JSON object; categories with no input members are omitted.
  full_coverage="false"
  [[ $has_missing -eq 0 ]] && full_coverage="true"

  printf '{'
  printf '"typeName":'; json_string "$TYPE_NAME"; printf ','
  printf '"docFile":'; json_string "$DOC_FILE"; printf ','
  printf '"categories":{'
  first=1
  if [[ "$comp_total" -gt 0 ]]; then
    [[ $first -eq 0 ]] && printf ','
    printf '"companion":{"total":%s,"documented":%s,"missing":' "$comp_total" "$((comp_total - comp_miss_count))"
    json_array_from_file "$COMPANION_MISSING"
    printf '}'
    first=0
  fi
  if [[ "$api_total" -gt 0 ]]; then
    [[ $first -eq 0 ]] && printf ','
    printf '"publicApi":{"total":%s,"documented":%s,"missing":' "$api_total" "$((api_total - api_miss_count))"
    json_array_from_file "$API_MISSING"
    printf '}'
    first=0
  fi
  if [[ "$inh_total" -gt 0 ]]; then
    [[ $first -eq 0 ]] && printf ','
    printf '"inherited":{"total":%s,"documented":%s,"missing":' "$inh_total" "$((inh_total - inh_miss_count))"
    json_array_from_file "$INHERITED_MISSING"
    printf '}'
  fi
  printf '},"fullCoverage":%s}\n' "$full_coverage"

  [[ $has_missing -eq 0 ]] && exit 0 || exit 1
fi

# Default text output
report_category() {
  local label="$1" members_file="$2" missing_file="$3" missing_marker="$4"
  if [[ -s "$members_file" ]]; then
    echo "=== $label ==="
    wc -l < "$members_file" | xargs echo "Total methods:" | sed 's/^/  /'
    if [[ -s "$missing_file" ]]; then
      echo "  $missing_marker Missing from documentation:"
      sed 's/^/    /' "$missing_file"
    else
      echo "  ✓ All documented"
    fi
    echo ""
  fi
}

report_category "Companion Object Members" "$COMPANION_MEMBERS" "$COMPANION_MISSING" "❌"
report_category "Public API"                "$API_MEMBERS"       "$API_MISSING"       "❌"
report_category "Inherited Methods"         "$INHERITED_MEMBERS" "$INHERITED_MISSING" "⚠"

echo "=== Coverage Summary ==="
if [[ $has_missing -eq 0 ]]; then
  echo "✓ Complete coverage: all members documented"
  exit 0
else
  echo "❌ Incomplete coverage: some members missing from documentation"
  exit 1
fi
