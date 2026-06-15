/**
 * Rule 26: Remove `implicit trace: Trace` from method signatures.
 *
 * ZIO's compiler macros inject implicit trace parameters automatically.
 * They should never appear in documented signatures, as they're implementation
 * details, not part of the public API.
 *
 * Bad:  def take(implicit trace: Trace): UIO[A]
 * Good: def take(): UIO[A]
 */

export interface Rule26Violation {
  line: number;
  content: string;
  match: string;
}

export interface Rule26FixResult {
  fixed: boolean;
  violations: Rule26Violation[];
  fixedContent: string;
  appliedCount: number;
}

/**
 * Find all violations of Rule 26 in markdown content.
 * Only checks inside scala code blocks.
 */
export function findRule26Violations(content: string): Rule26Violation[] {
  const lines = content.split('\n');
  const violations: Rule26Violation[] = [];
  let inScalaBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track code block state
    if (line.match(/^```scala\b/)) {
      inScalaBlock = true;
      continue;
    }
    if (line.match(/^```/) && inScalaBlock) {
      inScalaBlock = false;
      continue;
    }

    // Check for violations only in scala blocks
    if (inScalaBlock) {
      const match = line.match(/implicit\s+trace\s*:\s*Trace/i);
      if (match) {
        violations.push({
          line: i + 1,
          content: line,
          match: match[0],
        });
      }
    }
  }

  return violations;
}

/**
 * Remove `implicit trace: Trace` from a single line.
 * Handles various formatting:
 * - (implicit trace: Trace) → ()
 * - (x: T, implicit trace: Trace) → (x: T)
 * - (implicit trace: Trace, x: T) → (x: T)
 * - implicit trace: Trace in method signature
 */
function removeImplicitTraceFromLine(line: string): { fixed: string; changed: boolean } {
  let fixed = line;
  let changed = false;

  // Pattern 1: Remove standalone implicit trace with surrounding parens/commas
  // Handles: (implicit trace: Trace)
  const pattern1 = /\(\s*implicit\s+trace\s*:\s*Trace\s*\)/gi;
  if (pattern1.test(fixed)) {
    fixed = fixed.replace(pattern1, '()');
    changed = true;
  }

  // Pattern 2: Remove with preceding comma (has other parameters before)
  // Handles: (x: T, implicit trace: Trace)
  const pattern2 = /,\s*implicit\s+trace\s*:\s*Trace(?=\s*[),:])/gi;
  if (pattern2.test(fixed)) {
    fixed = fixed.replace(pattern2, '');
    changed = true;
  }

  // Pattern 3: Remove with trailing comma (has other parameters after)
  // Handles: (implicit trace: Trace, x: T)
  const pattern3 = /implicit\s+trace\s*:\s*Trace\s*,\s*/gi;
  if (pattern3.test(fixed)) {
    fixed = fixed.replace(pattern3, '');
    changed = true;
  }

  // Pattern 4: Standalone parameter (no parens around it, but in signature context)
  // Handles: implicit trace: Trace in parameter list
  const pattern4 = /implicit\s+trace\s*:\s*Trace/gi;
  if (pattern4.test(fixed) && !changed) {
    // Only apply if not already handled by patterns 1-3
    fixed = fixed.replace(pattern4, '');
    changed = true;
  }

  return { fixed, changed };
}

/**
 * Fix all Rule 26 violations in markdown content.
 * Returns the fixed content and a report of changes.
 */
export function fixRule26(content: string): Rule26FixResult {
  const lines = content.split('\n');
  const violations: Rule26Violation[] = [];
  let inScalaBlock = false;
  let appliedCount = 0;

  const fixedLines = lines.map((line, i) => {
    // Track code block state
    if (line.match(/^```scala\b/)) {
      inScalaBlock = true;
      return line;
    }
    if (line.match(/^```/) && inScalaBlock) {
      inScalaBlock = false;
      return line;
    }

    // Fix violations only in scala blocks
    if (inScalaBlock) {
      const match = line.match(/implicit\s+trace\s*:\s*Trace/i);
      if (match) {
        violations.push({
          line: i + 1,
          content: line,
          match: match[0],
        });

        const { fixed, changed } = removeImplicitTraceFromLine(line);
        if (changed) {
          appliedCount++;
          return fixed;
        }
      }
    }

    return line;
  });

  return {
    fixed: appliedCount > 0,
    violations,
    fixedContent: fixedLines.join('\n'),
    appliedCount,
  };
}

/**
 * Check if content violates Rule 26 without fixing.
 * Useful for validation phases.
 */
export function violatesRule26(content: string): boolean {
  return findRule26Violations(content).length > 0;
}

/**
 * Format violation for human-readable output.
 * Example: "file.md:42: [Rule 26] remove \"implicit trace: Trace\" from method signatures (ZIO convention)"
 */
export function formatViolation(filename: string, violation: Rule26Violation): string {
  return `${filename}:${violation.line}: [Rule 26] remove "${violation.match}" from method signatures (ZIO convention)`;
}
