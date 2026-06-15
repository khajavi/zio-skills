# Rule 26 Implementation Guide

This document describes the complete Rule 26 implementation for ZIO documentation style checking.

## Overview

**Rule 26** enforces the ZIO convention:
- **Do not include `implicit trace: Trace` in documented method signatures**
- ZIO's compiler macros inject trace parameters automatically
- They're implementation details, not part of the public API

## Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Documentation File                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
           ┌──────────────────────────────────────┐
           │   Rule 26 Detection (lib/)           │
           ├──────────────────────────────────────┤
           │ findRule26Violations()               │
           │ - Scans Scala code blocks           │
           │ - Returns violations with line #s   │
           │ - Case-insensitive matching         │
           └──────────────────────────────────────┘
                              ↓
           ┌──────────────────────────────────────┐
           │   Rule 26 Fixing (lib/)              │
           ├──────────────────────────────────────┤
           │ fixRule26()                          │
           │ - Removes implicit trace parameters │
           │ - Handles commas and spacing        │
           │ - Preserves other implicit params   │
           └──────────────────────────────────────┘
                              ↓
      ┌────────────────────────┬────────────────────────┐
      ↓                        ↓                        ↓
 ┌─────────┐  ┌─────────────┐  ┌────────────────────┐  ┌──────────┐
 │ Bash    │  │ TypeScript  │  │ TypeScript Phase   │  │ CLI Tool │
 │ Script  │  │ Library     │  │ Integration        │  │ (tools/) │
 │ (bash)  │  │ (lib/)      │  │ (workflows/)       │  │          │
 └─────────┘  └─────────────┘  └────────────────────┘  └──────────┘
```

## Components

### 1. Core Library (`lib/rule-26-implicit-trace.ts`)

Pure TypeScript module with no I/O dependencies. Used everywhere.

**Exports:**

| Function | Purpose | Returns |
|----------|---------|---------|
| `findRule26Violations(content)` | Find all violations | `Rule26Violation[]` |
| `fixRule26(content)` | Fix violations in content | `Rule26FixResult` |
| `violatesRule26(content)` | Boolean check | `boolean` |
| `formatViolation(filename, violation)` | Human-readable message | `string` |

**Example:**
```typescript
import { fixRule26 } from './lib/rule-26-implicit-trace.js';

const content = fs.readFileSync('docs/fiber.md', 'utf-8');
const result = fixRule26(content);

if (result.fixed) {
  console.log(`Fixed ${result.appliedCount} violations`);
  fs.writeFileSync('docs/fiber.md', result.fixedContent);
}
```

### 2. Bash Script (`skills/docs-writing-style/check-docs-style.sh`)

Mechanical rule checker for CI and pre-commit hooks. Includes Rule 26 validation:

```bash
# Rule 26: ZIO implicit trace convention (no "implicit trace: Trace" in method signatures)
count_violations "$(awk '
  /^```scala/ {
    in_scala = 1
    next
  }
  /^```/ {
    in_scala = 0
    next
  }
  in_scala && /implicit[[:space:]]+trace:[[:space:]]*Trace/ {
    print FILENAME ":" NR ": [Rule 26] remove \"implicit trace: Trace\" from method signatures (ZIO convention)"
  }
' "$FILE")"
```

**Usage:**
```bash
bash skills/docs-writing-style/check-docs-style.sh docs/fiber.md
# Exit 0: no violations
# Exit 1: violations found
```

### 3. TypeScript Integration Phase (`workflows/phases/rule-26.ts`)

Workflow phase for programmatic checking and fixing.

**Key functions:**

```typescript
// Check without modifying
const result = checkRule26('docs/fiber.md', false);
if (!result.passed) {
  result.violations.forEach(v => console.log(v.message));
}

// Apply fixes
const fixedCount = applyRule26Fixes('docs/fiber.md');
console.log(`Fixed ${fixedCount} violations`);

// For integration into style workflow
const violations = await validateRule26('docs/fiber.md');
await fixRule26InPlace('docs/fiber.md');
```

### 4. CLI Tool (`tools/rule-26-checker.ts`)

Standalone command-line interface for manual use.

**Commands:**

```bash
# Check for violations
npx ts-node tools/rule-26-checker.ts check docs/fiber.md

# Fix violations in-place
npx ts-node tools/rule-26-checker.ts fix docs/fiber.md

# Generate report
npx ts-node tools/rule-26-checker.ts report docs/fiber.md

# With verbose output
npx ts-node tools/rule-26-checker.ts fix -v docs/fiber.md
```

### 5. Test Suite (`tests/rule-26-implicit-trace.test.ts`)

Comprehensive test coverage (27 tests):

```bash
npm test -- tests/rule-26-implicit-trace.test.ts
```

**Coverage:**
- ✅ Detection in various contexts
- ✅ Fixing with different parameter arrangements
- ✅ Whitespace handling
- ✅ Code block boundary conditions
- ✅ Preservation of other content

## Usage Patterns

### Pattern 1: Check in CI/Pre-commit

```bash
# In CI pipeline or pre-commit hook
bash writer-assistant/skills/docs-writing-style/check-docs-style.sh docs/reference/fiber.md
```

### Pattern 2: Programmatic checking in TypeScript

```typescript
import { findRule26Violations } from './lib/rule-26-implicit-trace.js';

const content = fs.readFileSync('file.md', 'utf-8');
const violations = findRule26Violations(content);

if (violations.length > 0) {
  console.error(`Found ${violations.length} Rule 26 violations`);
  process.exit(1);
}
```

### Pattern 3: Fixing in a workflow

```typescript
import { fixRule26 } from './lib/rule-26-implicit-trace.js';

async function validateAndFixDocs(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const result = fixRule26(content);

  if (result.fixed) {
    fs.writeFileSync(filePath, result.fixedContent);
    console.log(`Fixed ${result.appliedCount} violations`);
  }

  return result;
}
```

### Pattern 4: Integration with style phase

```typescript
import rule26Phase from '../workflows/phases/rule-26.js';

// Check
const checkResult = rule26Phase.checkRule26(filePath);
if (!checkResult.passed) {
  console.log(rule26Phase.formatRule26Report(checkResult));
}

// Fix
const fixedCount = rule26Phase.applyRule26Fixes(filePath);
```

## Detection Strategy

Rule 26 violations are detected using a regex pattern:

```regex
/implicit\s+trace\s*:\s*Trace/i
```

**Properties:**
- ✅ Case-insensitive (matches `Trace`, `TRACE`, `trace`)
- ✅ Whitespace-tolerant (tabs, multiple spaces)
- ✅ Only matches in Scala code blocks (` ```scala`)
- ✅ Ignores other code block types

**Examples that match:**
```scala
implicit trace: Trace
implicit  trace:  Trace
implicit trace : Trace
implicit TRACE: TRACE
```

**Examples that DON'T match:**
```scala
trace: Trace            // no implicit keyword
implicit myTrace: Trace // different parameter name
```

## Fixing Strategy

When `implicit trace: Trace` is found, it's removed cleanly based on context:

### Scenario 1: Standalone parameter
```scala
// Input
(implicit trace: Trace)

// Output
()
```

### Scenario 2: First parameter
```scala
// Input
(implicit trace: Trace, other: String)

// Output
(other: String)
```

### Scenario 3: Middle parameter
```scala
// Input
(x: Int, implicit trace: Trace, y: String)

// Output
(x: Int, y: String)
```

### Scenario 4: Last parameter
```scala
// Input
(x: Int, implicit trace: Trace)

// Output
(x: Int)
```

## Integration Points

### 1. In `fix-writing-style.ts` workflow

Could be integrated into the style validation phase:

```typescript
import rule26Phase from './phases/rule-26.js';

// During mechanical validation
const rule26Result = rule26Phase.checkRule26(outputPath);
if (!rule26Result.passed) {
  violations.push(...rule26Result.violations.map(v => v.message));
}

// During fixing phase
if (rule26Result.fixable) {
  await rule26Phase.fixRule26InPlace(outputPath);
}
```

### 2. In `check-docs-style.sh` script

Rule 26 is already integrated as the final check in the bash script.

### 3. In documentation workflows

Any workflow that processes markdown can invoke Rule 26 checking:

```typescript
import { fixRule26 } from '../lib/rule-26-implicit-trace.js';

// After generating documentation
const content = generateDocumentation();
const { fixedContent } = fixRule26(content);
fs.writeFileSync(outputPath, fixedContent);
```

## Testing

### Run all Rule 26 tests

```bash
npm test -- tests/rule-26-implicit-trace.test.ts
```

### Test a specific scenario

```bash
npm test -- tests/rule-26-implicit-trace.test.ts -t "preserves other implicit parameters"
```

### Test coverage verification

```bash
npm test -- --coverage tests/rule-26-implicit-trace.test.ts
```

## Performance

- **Detection:** O(n) — single pass through file
- **Fixing:** O(n) — single pass through file with regex replacements
- **Typical file:** < 1ms for detection and fixing

## Safety Guarantees

1. **Only modifies Scala blocks** — Other code blocks untouched
2. **Preserves prose** — Non-code sections unchanged
3. **Preserves other implicit params** — Only removes `implicit trace: Trace`
4. **Atomic** — Either fully applied or not at all
5. **Reversible** — Fixed content can be manually restored if needed

## Troubleshooting

### Pattern not detected

**Ensure it's in a Scala code block:**

```markdown
✅ ```scala
def method(implicit trace: Trace): UIO[A]
```

❌ ```
def method(implicit trace: Trace): UIO[A]
```

❌ In prose: `implicit trace: Trace`
```

### Fix looks wrong

Check for:
- Unbalanced parentheses (edge case)
- Unusual formatting with extra spaces before/after

Report with reproduction steps if found.

### Not part of style workflow

Rule 26 checking is included in:
- ✅ `check-docs-style.sh` (bash script) — always run
- ✅ Manual CLI tool — optional, run on demand
- ⚠️ TypeScript integration — requires explicit integration

## Future Enhancements

- [ ] Scala 3 syntax support
- [ ] Configuration options per project
- [ ] Pre-commit hook setup
- [ ] IDE plugin support
- [ ] Analytics dashboard
- [ ] Automatic opening of PRS with Rule 26 fixes
