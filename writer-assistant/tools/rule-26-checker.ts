#!/usr/bin/env node

/**
 * CLI tool for Rule 26: Implicit Trace Checker
 *
 * Usage:
 *   npx ts-node tools/rule-26-checker.ts check <file.md>
 *   npx ts-node tools/rule-26-checker.ts fix <file.md>
 *   npx ts-node tools/rule-26-checker.ts report <file.md>
 */

import fs from 'node:fs';
import path from 'node:path';
import { findRule26Violations, fixRule26, formatViolation } from '../lib/rule-26-implicit-trace.js';

const args = process.argv.slice(2);

function usage(): void {
  console.log(`
Rule 26 Checker — ZIO Implicit Trace Convention

Ensures method signatures don't include 'implicit trace: Trace' parameters.
ZIO's compiler macros inject these automatically—they're implementation
details, not part of the public API.

Usage:
  rule-26-checker check <file.md>     Check for violations (exit 1 if found)
  rule-26-checker fix <file.md>       Fix violations in-place
  rule-26-checker report <file.md>    Show violations without fixing

Options:
  -h, --help    Show this help and exit
  -v, --verbose Print detailed information

Exit codes:
  0 — No violations or fix successful
  1 — Violations found (check mode)
  2 — File not found or invocation error
`);
}

function fileNotFound(filename: string): void {
  console.error(`Error: File not found: ${filename}`);
  process.exit(2);
}

function check(filename: string, verbose: boolean): void {
  if (!fs.existsSync(filename)) {
    fileNotFound(filename);
  }

  const content = fs.readFileSync(filename, 'utf-8');
  const violations = findRule26Violations(content);

  if (violations.length === 0) {
    if (verbose) console.log(`✓ ${filename}: No violations`);
    process.exit(0);
  }

  violations.forEach((violation) => {
    console.log(formatViolation(filename, violation));
  });

  console.log(`\n✗ Found ${violations.length} violation(s)`);
  process.exit(1);
}

function fix(filename: string, verbose: boolean): void {
  if (!fs.existsSync(filename)) {
    fileNotFound(filename);
  }

  const content = fs.readFileSync(filename, 'utf-8');
  const result = fixRule26(content);

  if (!result.fixed) {
    if (verbose) console.log(`✓ ${filename}: No violations found`);
    process.exit(0);
  }

  // Write fixed content back to file
  fs.writeFileSync(filename, result.fixedContent, 'utf-8');

  console.log(`✓ Fixed ${result.appliedCount} violation(s) in ${filename}`);
  if (verbose) {
    result.violations.forEach((violation) => {
      console.log(`  Line ${violation.line}: ${violation.match}`);
    });
  }

  process.exit(0);
}

function report(filename: string): void {
  if (!fs.existsSync(filename)) {
    fileNotFound(filename);
  }

  const content = fs.readFileSync(filename, 'utf-8');
  const violations = findRule26Violations(content);

  console.log(`Rule 26 Report: ${filename}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (violations.length === 0) {
    console.log('✓ No violations found');
    process.exit(0);
  }

  console.log(`\nViolations (${violations.length}):\n`);
  violations.forEach((violation, idx) => {
    console.log(`${idx + 1}. Line ${violation.line}:`);
    console.log(`   ${violation.content.trim()}`);
    console.log(`   ^^^ ${violation.match}`);
    console.log();
  });

  console.log(`Summary: ${violations.length} violation(s) found`);
  process.exit(1);
}

// Main
const command = args[0];
const filename = args[1];
const verbose = args.includes('-v') || args.includes('--verbose');

if (args.includes('-h') || args.includes('--help') || !command) {
  usage();
  process.exit(command ? 0 : 2);
}

if (!filename) {
  console.error('Error: filename argument required');
  usage();
  process.exit(2);
}

const absolutePath = path.resolve(filename);

switch (command) {
  case 'check':
    check(absolutePath, verbose);
    break;
  case 'fix':
    fix(absolutePath, verbose);
    break;
  case 'report':
    report(absolutePath);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(2);
}
