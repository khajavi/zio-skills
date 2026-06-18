/**
 * Rule 26 checking phase — ZIO implicit trace convention validation.
 *
 * Detects and reports violations of Rule 26: method signatures in documentation
 * must not include `implicit trace: Trace` parameters.
 *
 * This phase is typically run as part of the mechanical validation workflow.
 */

import * as fs from 'node:fs';
import {
  findRule26Violations,
  fixRule26,
  formatViolation,
} from '../../lib/rule-26-implicit-trace.js';

export interface Rule26CheckResult {
  passed: boolean;
  violations: Array<{
    line: number;
    content: string;
    message: string;
  }>;
  fixable: boolean;
  fixedContent?: string;
}

/**
 * Check a file for Rule 26 violations.
 *
 * @param filePath Absolute path to markdown file
 * @param autoFix If true, also return fixed content (but don't write to disk)
 * @returns Result object with violations and optional fixed content
 */
export function checkRule26(filePath: string, autoFix: boolean = false): Rule26CheckResult {
  if (!fs.existsSync(filePath)) {
    return {
      passed: true,
      violations: [],
      fixable: false,
      fixedContent: undefined,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = findRule26Violations(content);

  const result: Rule26CheckResult = {
    passed: violations.length === 0,
    violations: violations.map((v) => ({
      line: v.line,
      content: v.content,
      message: formatViolation(filePath, v),
    })),
    fixable: violations.length > 0,
  };

  if (autoFix && violations.length > 0) {
    const fixResult = fixRule26(content);
    result.fixedContent = fixResult.fixedContent;
  }

  return result;
}

/**
 * Apply Rule 26 fixes to a file (modifies file in-place).
 *
 * @param filePath Absolute path to markdown file
 * @returns Number of violations fixed, or -1 if file not found
 */
export function applyRule26Fixes(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    console.warn(`[Rule 26] File not found: ${filePath}`);
    return -1;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const result = fixRule26(content);

  if (result.fixed) {
    fs.writeFileSync(filePath, result.fixedContent, 'utf-8');
    console.log(`[Rule 26] Fixed ${result.appliedCount} violation(s) in ${filePath}`);
  }

  return result.appliedCount;
}

/**
 * Format Rule 26 violations for console output.
 *
 * @param result Check result from checkRule26()
 * @returns Formatted string for display
 */
export function formatRule26Report(result: Rule26CheckResult): string {
  if (result.passed) {
    return '✓ Rule 26 passed (no implicit trace parameters)';
  }

  const lines = [`✗ Rule 26 violations (${result.violations.length})`, ''];

  result.violations.forEach((v) => {
    lines.push(v.message);
    lines.push(`  ${v.content.trim()}`);
  });

  return lines.join('\n');
}

/**
 * Integration hook for style validation phase.
 * Returns violations found in the file.
 */
export async function validateRule26(filePath: string): Promise<Array<string>> {
  const result = checkRule26(filePath);
  return result.violations.map((v) => v.message);
}

/**
 * Integration hook for style fixing phase.
 * Applies fixes to the file and returns the count of fixes applied.
 */
export async function fixRule26InPlace(filePath: string): Promise<number> {
  return applyRule26Fixes(filePath);
}

export default {
  checkRule26,
  applyRule26Fixes,
  formatRule26Report,
  validateRule26,
  fixRule26InPlace,
};
