import { describe, it, expect } from 'vitest';
import {
  findRule26Violations,
  fixRule26,
  violatesRule26,
  formatViolation,
} from '../lib/rule-26-implicit-trace.js';

describe('Rule 26: Implicit Trace Checker', () => {
  describe('findRule26Violations', () => {
    it('detects implicit trace in scala code blocks', () => {
      const content = `
## Methods

To take elements:

\`\`\`scala
def take(n: Int)(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(1);
      expect(violations[0].line).toBe(6);
      expect(violations[0].match).toMatch(/implicit\s+trace\s*:\s*Trace/i);
    });

    it('ignores implicit trace in non-scala blocks', () => {
      const content = `
\`\`\`
def take(implicit trace: Trace): UIO[A]
\`\`\`

\`\`\`javascript
// implicit trace: Trace is not relevant here
\`\`\`
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(0);
    });

    it('ignores implicit trace in markdown prose', () => {
      const content = `
## Note

Never use \`implicit trace: Trace\` in your documentation.
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(0);
    });

    it('finds multiple violations', () => {
      const content = `
\`\`\`scala
def take(implicit trace: Trace): UIO[A] = ???
def drop(implicit trace: Trace): UIO[A] = ???
\`\`\`
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(2);
    });

    it('is case-insensitive', () => {
      const content = `
\`\`\`scala
def method(IMPLICIT TRACE: TRACE): UIO[A]
\`\`\`
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(1);
    });

    it('handles different whitespace patterns', () => {
      const content = `
\`\`\`scala
def a(implicit trace: Trace): UIO[A]
def b(implicit  trace:  Trace): UIO[A]
def c(implicit\ttrace:\tTrace): UIO[A]
\`\`\`
`.trim();

      const violations = findRule26Violations(content);
      expect(violations).toHaveLength(3);
    });

    it('returns line numbers correctly', () => {
      const content = `Line 1
Line 2
\`\`\`scala
Line 4
def method(implicit trace: Trace): UIO[A]
\`\`\`
Line 7`;

      const violations = findRule26Violations(content);
      expect(violations[0].line).toBe(5);
    });
  });

  describe('fixRule26', () => {
    it('removes implicit trace parameter', () => {
      const content = `
\`\`\`scala
def take(n: Int)(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(1);
      expect(result.fixedContent).toContain('def take(n: Int)()');
    });

    it('removes implicit trace with multiple parameters', () => {
      const content = `
\`\`\`scala
def map[B](f: A => B)(implicit trace: Trace): ZIO[R, E, B]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('def map[B](f: A => B)()');
    });

    it('removes implicit trace when it is the only parameter', () => {
      const content = `
\`\`\`scala
def take(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('def take()');
    });

    it('handles trailing comma after implicit trace', () => {
      const content = `
\`\`\`scala
def method(implicit trace: Trace, other: String): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('def method(other: String)');
    });

    it('handles leading comma before implicit trace', () => {
      const content = `
\`\`\`scala
def method(x: Int, implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('def method(x: Int)');
    });

    it('fixes multiple violations in same code block', () => {
      const content = `
\`\`\`scala
def take(implicit trace: Trace): UIO[A]
def drop(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(2);
    });

    it('preserves non-scala code blocks', () => {
      const content = `
\`\`\`javascript
function method(implicit trace: Trace) {}
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(false);
      expect(result.fixedContent).toContain('implicit trace: Trace');
    });

    it('preserves content outside code blocks', () => {
      const content = `
# ZIO Method Reference

This describes implicit trace: Trace behavior.

\`\`\`scala
def take(implicit trace: Trace): UIO[A]
\`\`\`

Never mention implicit trace: Trace in code.
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('This describes implicit trace: Trace behavior.');
      expect(result.fixedContent).toContain('Never mention implicit trace: Trace in code.');
    });

    it('handles closing parens correctly', () => {
      const content = `
\`\`\`scala
def method(): UIO[A] = {
  def inner(implicit trace: Trace): UIO[B]
  ???
}
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('def inner(): UIO[B]');
    });

    it('reports violations even when fixing', () => {
      const content = `
\`\`\`scala
def take(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.violations.length).toBe(1);
      expect(result.violations[0].line).toBe(2);
    });

    it('does not fix code blocks that are not scala', () => {
      const content = `
\`\`\`scala mdoc
def take(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true); // scala mdoc is part of scala syntax
      expect(result.fixedContent).not.toContain('implicit trace');
    });
  });

  describe('violatesRule26', () => {
    it('returns true when violations exist', () => {
      const content = `
\`\`\`scala
def take(implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      expect(violatesRule26(content)).toBe(true);
    });

    it('returns false when no violations exist', () => {
      const content = `
\`\`\`scala
def take(): UIO[A]
\`\`\`
`.trim();

      expect(violatesRule26(content)).toBe(false);
    });

    it('ignores violations outside scala blocks', () => {
      const content = `
Do not use implicit trace: Trace here.
\`\`\`
def take(implicit trace: Trace)
\`\`\`
`.trim();

      expect(violatesRule26(content)).toBe(false);
    });
  });

  describe('formatViolation', () => {
    it('formats violation message correctly', () => {
      const violation = {
        line: 42,
        content: 'def take(implicit trace: Trace): UIO[A]',
        match: 'implicit trace: Trace',
      };

      const message = formatViolation('fiber.md', violation);
      expect(message).toBe(
        'fiber.md:42: [Rule 26] remove "implicit trace: Trace" from method signatures (ZIO convention)'
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty content', () => {
      const result = fixRule26('');
      expect(result.fixed).toBe(false);
      expect(result.appliedCount).toBe(0);
      expect(result.violations).toEqual([]);
    });

    it('handles code block at end of file', () => {
      const content = `# Reference

\`\`\`scala
def take(implicit trace: Trace): UIO[A]
\`\`\``;

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(1);
    });

    it('preserves other implicit parameters', () => {
      const content = `
\`\`\`scala
def method(implicit ec: ExecutionContext, implicit trace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.fixedContent).toContain('implicit ec: ExecutionContext');
      expect(result.fixedContent).not.toContain('implicit trace: Trace');
    });

    it('preserves similar but different patterns', () => {
      const content = `
\`\`\`scala
def method(trace: Trace): UIO[A]
def other(implicit myTrace: Trace): UIO[A]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(false);
      expect(result.violations).toHaveLength(0);
    });

    it('handles multiple code blocks', () => {
      const content = `
\`\`\`scala
def a(implicit trace: Trace): UIO[A]
\`\`\`

Some text.

\`\`\`scala
def b(implicit trace: Trace): UIO[B]
\`\`\`
`.trim();

      const result = fixRule26(content);
      expect(result.fixed).toBe(true);
      expect(result.appliedCount).toBe(2);
    });
  });
});
