# Rule 26 Implementation Summary

**Rule 26: Never include `implicit trace: Trace` in documented method signatures.**

This is a complete mechanical rule checker for ZIO's implicit trace convention.

## What Was Implemented

### 1. Core Library (`lib/rule-26-implicit-trace.ts`)
- Pure TypeScript module for detection and fixing
- No I/O dependencies — can be used anywhere
- 4 exported functions:
  - `findRule26Violations()` — find all violations
  - `fixRule26()` — remove violations from content
  - `violatesRule26()` — boolean check
  - `formatViolation()` — human-readable messages

### 2. Test Suite (`tests/rule-26-implicit-trace.test.ts`)
- 27 comprehensive tests
- ✅ All passing
- Coverage:
  - Detection across multiple contexts
  - Fixing in all parameter positions
  - Whitespace handling
  - Edge cases and boundary conditions

### 3. CLI Tool (`tools/rule-26-checker.ts`)
- Standalone command-line interface
- Three modes:
  - `check` — verify no violations exist
  - `fix` — remove violations in-place
  - `report` — detailed violation report
- Verbose output option

### 4. Workflow Integration (`workflows/phases/rule-26.ts`)
- Programmatic integration for documentation workflows
- Functions:
  - `checkRule26()` — validation without fixing
  - `applyRule26Fixes()` — fix and save file
  - `formatRule26Report()` — formatted output
  - `validateRule26()` — async integration hook
  - `fixRule26InPlace()` — async fixing hook

### 5. Documentation (`docs/`)
- **RULE-26-CHECKER.md** — User guide with examples
- **RULE-26-IMPLEMENTATION.md** — Architecture and integration guide

## How It Works

### Detection

Scans Scala code blocks for the pattern:
```regex
/implicit\s+trace\s*:\s*Trace/i
```

Only checks inside ` ```scala` blocks. Ignores prose, other code blocks, and non-Scala content.

### Fixing

Removes `implicit trace: Trace` cleanly, handling all parameter positions:

```scala
// BEFORE
def take(implicit trace: Trace): UIO[A]

// AFTER
def take(): UIO[A]
```

## Integration Points

### Bash Script Integration

Already included in `skills/docs-writing-style/check-docs-style.sh`:

```bash
# Rule 26: ZIO implicit trace convention
count_violations "$(awk '
  /^```scala/ { in_scala = 1; next }
  /^```/ { in_scala = 0; next }
  in_scala && /implicit[[:space:]]+trace:[[:space:]]*Trace/ {
    print FILENAME ":" NR ": [Rule 26] ..."
  }
' "$FILE")"
```

### TypeScript Usage

```typescript
import { fixRule26 } from './lib/rule-26-implicit-trace.js';

const content = fs.readFileSync('docs/fiber.md', 'utf-8');
const result = fixRule26(content);

if (result.fixed) {
  fs.writeFileSync('docs/fiber.md', result.fixedContent);
  console.log(`Fixed ${result.appliedCount} violations`);
}
```

### CLI Usage

```bash
# Check for violations
npx ts-node tools/rule-26-checker.ts check docs/fiber.md

# Fix violations
npx ts-node tools/rule-26-checker.ts fix docs/fiber.md

# Generate report
npx ts-node tools/rule-26-checker.ts report docs/fiber.md
```

## Testing

All tests pass:

```bash
npm test -- tests/rule-26-implicit-trace.test.ts
# ✓ 27 tests passed
```

Run with other tests:

```bash
npm test
# ✓ 171 tests passed (includes all other tests)
```

## Files Created

```
writer-assistant/
├── lib/
│   └── rule-26-implicit-trace.ts          (Core library)
├── tests/
│   └── rule-26-implicit-trace.test.ts     (Test suite)
├── tools/
│   └── rule-26-checker.ts                 (CLI tool)
├── workflows/phases/
│   └── rule-26.ts                         (Integration phase)
└── docs/
    ├── RULE-26-CHECKER.md                 (User guide)
    └── RULE-26-IMPLEMENTATION.md          (Architecture guide)
```

## Features

✅ **Mechanical** — Pure regex, no LLM dependency
✅ **Fast** — O(n) detection and fixing
✅ **Safe** — Never modifies code outside Scala blocks
✅ **Tested** — 27 comprehensive tests
✅ **Documented** — User and architecture guides
✅ **Integrated** — Works with bash scripts and TypeScript
✅ **Reversible** — Fixed content is valid documentation

## Example Violations Fixed

```scala
// ❌ BEFORE
trait ZIO[-R, +E, +A] {
  def take(n: Int)(implicit trace: Trace): ZIO[R, E, Chunk[A]]
  def drop(n: Int)(implicit trace: Trace): ZIO[R, E, Unit]
}

// ✅ AFTER
trait ZIO[-R, +E, +A] {
  def take(n: Int): ZIO[R, E, Chunk[A]]
  def drop(n: Int): ZIO[R, E, Unit]
}
```

## Next Steps

1. **Use in CI** — Run `check-docs-style.sh` in CI to catch violations
2. **Use locally** — Run `rule-26-checker fix` before committing
3. **Integrate** — Add to your documentation workflow pipeline
4. **Extend** — Add more rules using the same pattern

## Notes

- Rule 26 detection is **already in the bash script** (`check-docs-style.sh`)
- The TypeScript implementation provides **programmatic access** for workflows
- The CLI tool provides **convenient manual fixing**
- All implementations share the **same pure library** (`lib/rule-26-implicit-trace.ts`)
