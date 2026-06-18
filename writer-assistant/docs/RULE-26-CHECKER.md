# Rule 26: Implicit Trace Checker

**Rule 26** enforces ZIO's convention that method signatures in documentation should **never include `implicit trace: Trace` parameters**.

> ZIO's compiler macros inject implicit trace parameters automatically during compilation. They're implementation details, not part of the public API and should not appear in documented method signatures.

## Quick Start

### Check for violations

```bash
npx ts-node tools/rule-26-checker.ts check docs/reference/fiber.md
```

Exit code: `0` (no violations) or `1` (violations found)

### Fix violations automatically

```bash
npx ts-node tools/rule-26-checker.ts fix docs/reference/fiber.md
```

Rewrites the file in-place, removing all `implicit trace: Trace` parameters from Scala code blocks.

### Generate a report

```bash
npx ts-node tools/rule-26-checker.ts report docs/reference/fiber.md
```

Shows all violations with line numbers and context.

## Examples

### Bad → Good

```scala
// ❌ BAD (implicit trace in signature)
def take(n: Int)(implicit trace: Trace): UIO[A]

// ✅ GOOD (removed)
def take(n: Int): UIO[A]
```

```scala
// ❌ BAD (only parameter)
def take(implicit trace: Trace): UIO[A]

// ✅ GOOD
def take(): UIO[A]
```

```scala
// ❌ BAD (mixed with other implicit params)
def method(implicit ec: ExecutionContext, implicit trace: Trace): UIO[A]

// ✅ GOOD
def method(implicit ec: ExecutionContext): UIO[A]
```

## Integration with Style Checking Workflow

Rule 26 is already integrated into the mechanical style checker (`check-docs-style.sh`). When you run:

```bash
bash skills/docs-writing-style/check-docs-style.sh docs/reference/fiber.md
```

It includes Rule 26 validation along with all other mechanical rules.

### For automated fixing

The `Rule26` module provides both detection and fixing:

```typescript
import { fixRule26, violatesRule26 } from './lib/rule-26-implicit-trace.js';

const content = fs.readFileSync('file.md', 'utf-8');

// Check if file violates Rule 26
if (violatesRule26(content)) {
  console.log('Rule 26 violations found');
}

// Fix all violations
const result = fixRule26(content);
if (result.fixed) {
  console.log(`Fixed ${result.appliedCount} violation(s)`);
  fs.writeFileSync('file.md', result.fixedContent);
}
```

## API Reference

### `findRule26Violations(content: string): Rule26Violation[]`

Scans markdown content and returns all Rule 26 violations found in Scala code blocks.

**Returns:**

- Array of violations with `line`, `content`, and `match` properties
- Empty array if no violations found

**Example:**

```typescript
const violations = findRule26Violations(content);
violations.forEach((v) => {
  console.log(`Line ${v.line}: ${v.match}`);
});
```

### `fixRule26(content: string): Rule26FixResult`

Removes all `implicit trace: Trace` parameters from Scala code blocks.

**Returns:**

```typescript
{
  fixed: boolean;           // true if at least one fix applied
  violations: Rule26Violation[];  // violations that were found
  fixedContent: string;     // content with fixes applied
  appliedCount: number;     // number of parameters removed
}
```

**Example:**

```typescript
const result = fixRule26(content);
if (result.fixed) {
  fs.writeFileSync('file.md', result.fixedContent);
  console.log(`Applied ${result.appliedCount} fixes`);
}
```

### `violatesRule26(content: string): boolean`

Quick boolean check — returns `true` if any Rule 26 violations exist.

**Example:**

```typescript
if (violatesRule26(content)) {
  const result = fixRule26(content);
  // ... apply fixes
}
```

### `formatViolation(filename: string, violation: Rule26Violation): string`

Formats a violation for human-readable output.

**Returns:** `"filename.md:42: [Rule 26] remove "implicit trace: Trace" from method signatures (ZIO convention)"`

## Implementation Details

### Detection

The checker identifies `implicit trace: Trace` patterns in Scala code blocks using case-insensitive regex:

```regex
/implicit\s+trace\s*:\s*Trace/i
```

Non-Scala code blocks are completely ignored (e.g., JavaScript, Python, plain text blocks).

### Fixing Strategy

When removing `implicit trace: Trace`, the fixer handles four scenarios:

1. **Standalone parameter** → Remove entire parameter

   ```scala
   (implicit trace: Trace) → ()
   ```

2. **Leading parameter** → Remove with trailing comma

   ```scala
   (implicit trace: Trace, x: T) → (x: T)
   ```

3. **Trailing parameter** → Remove with preceding comma

   ```scala
   (x: T, implicit trace: Trace) → (x: T)
   ```

4. **In parameter list** → Remove cleanly
   ```scala
   implicit trace: Trace → (removed)
   ```

### Safety Guarantees

- **Only modifies Scala blocks** — Non-Scala code blocks untouched
- **Preserves other content** — Prose, non-code sections remain unchanged
- **Preserves other implicit params** — Only removes `implicit trace: Trace`, not other implicit parameters
- **Preserves formatting** — Indentation, comment, and structure preserved

## Testing

Run the test suite:

```bash
npm test -- tests/rule-26-implicit-trace.test.ts
```

Test coverage:

- ✅ Multiple violation detection
- ✅ Parameter removal in all positions (leading, trailing, standalone)
- ✅ Whitespace handling (tabs, multiple spaces)
- ✅ Multiple code blocks
- ✅ Preservation of other implicit parameters
- ✅ Non-Scala block preservation

## Common Issues

### "No violations found" but I can see the pattern

Make sure the code is inside a **Scala code block**:

```markdown
✅ DETECTED:
\`\`\`scala
def method(implicit trace: Trace): UIO[A]
\`\`\`

❌ NOT DETECTED:
\`\`\`
def method(implicit trace: Trace): UIO[A]
\`\`\`

❌ NOT DETECTED (in prose):
In Scala, use `implicit trace: Trace` for...
```

### Fixed file looks wrong

Check for:

1. Unbalanced parentheses (report as issue)
2. Unusual formatting with `implicit trace: Trace` (regex-unfriendly)

### Preserving intentional examples

If you're documenting `implicit trace: Trace` as a **teaching example of what NOT to do**, put it in a plain code block (without ` ```scala`):

```markdown
❌ WRONG — Don't do this:

\`\`\`
def method(implicit trace: Trace): UIO[A]
\`\`\`
```

This block won't be checked or modified by the Rule 26 checker.

## Future Enhancements

- [ ] Support for Scala 3 syntax variations
- [ ] Integration with IDE/editor extensions
- [ ] Pre-commit hook configuration
- [ ] Batch processing with progress reporting
- [ ] Configuration file support for per-project rules
