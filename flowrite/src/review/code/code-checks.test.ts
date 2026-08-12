// The mechanical style graders. Pure string work — no Flue runtime, no model calls.
//
// Every grader gets two tests: one page that violates its rule, and one clean page that must stay
// silent. The clean case is the important one. A grader that fires on correct prose is worse than no
// grader at all, because the writer spends a turn "fixing" something that was already right — and,
// unlike a missed violation, nothing downstream catches it.
import assert from 'node:assert/strict';
import test from 'node:test';

import type { FlueHarness, FlueLogger } from '@flue/runtime';
import type { Check, CheckContext, ReviewItem } from '../check.ts';
import { style4 } from './style-4.ts';
import { style5 } from './style-5.ts';
import { style10 } from './style-10.ts';
import { style11 } from './style-11.ts';
import { style12 } from './style-12.ts';

const page = (...lines: string[]): string => lines.join('\n');

/** Code checks never touch the harness or the logger, so the test supplies neither. */
const context = (content: string): CheckContext => ({
  path: 'docs/reference/prism.md',
  content,
  lines: content.split('\n'),
  harness: undefined as unknown as FlueHarness,
  log: undefined as unknown as FlueLogger,
});

const failures = async (check: Check, content: string): Promise<ReviewItem[]> =>
  (await check.run(context(content))).filter((item) => !item.pass);

/** One correct page, checked against every grader in this file. */
const CLEAN = page(
  '---',
  'id: prism',
  'title: "Prism"',
  '---',
  '',
  '## Overview',
  '',
  'A prism focuses on one case of a sum type, so it may fail to match.',
  '',
  '### Creating a Prism',
  '',
  'Build one from a pair of functions:',
  '',
  '```scala',
  'import tinyoptics._',
  '',
  'val first = Prism[Either[Int, String], Int](_.left.toOption)(Left(_))',
  '```',
  '',
  'Two operations matter here:',
  '',
  '- Fragments in a list need no capital',
  '- Full sentences start with a capital letter.',
  '',
);

test('every grader stays silent on a correct page', async () => {
  for (const check of [style4, style5, style10, style11, style12]) {
    const items = await check.run(context(CLEAN));
    assert.deepEqual(
      items.filter((item) => !item.pass),
      [],
      `${check.id} fired on the clean page`,
    );
    assert.equal(items.length, 1, `${check.id} should report exactly one passing item`);
  }
});

test('style-4 flags a full-sentence bullet that starts lowercase', async () => {
  const found = await failures(
    style4,
    page('## Overview', '', 'Two things matter:', '', '- this bullet is a whole sentence.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].item, /^style-4 @ line 5$/);
});

test('style-4 ignores bullets that open with code, links or digits', async () => {
  // Capitalizing an identifier would be wrong, so these must never be reported.
  const found = await failures(
    style4,
    page(
      '## Overview',
      '',
      'Members:',
      '',
      '- `getOption` returns the focused value.',
      '- [Lens](./lens.md) always succeeds.',
      '- 2 arguments are required.',
      '',
    ),
  );
  assert.deepEqual(found, []);
});

test('style-5 flags a hard-wrapped paragraph and reports its first line', async () => {
  const found = await failures(
    style5,
    page('## Overview', '', 'A prism focuses on one case', 'of a sum type, so it may fail.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].item, /^style-5 @ line 3$/);
  assert.match(found[0].issue ?? '', /hard-wrapped across 2 lines/);
});

test('style-5 does not mistake a wrapped bullet for a wrapped paragraph', async () => {
  // List continuations are indented; real top-level prose in this corpus never is.
  const found = await failures(
    style5,
    page(
      '## Overview',
      '',
      'Members:',
      '',
      '- `getOption` returns the focused value when the case matches,',
      '  and nothing when it does not, which is the whole point',
      '  of a prism.',
      '',
    ),
  );
  assert.deepEqual(found, []);
});

test('style-5 fix joins the paragraph and is idempotent', async () => {
  const wrapped = page('## Overview', '', 'A prism focuses on one case', 'of a sum type.', '');
  const once = style5.fix?.(wrapped) ?? wrapped;
  assert.equal(once, page('## Overview', '', 'A prism focuses on one case of a sum type.', ''));
  assert.equal(style5.fix?.(once), once);
  assert.deepEqual(await failures(style5, once), []);
});

test('style-10 flags a heading repeating the frontmatter title', async () => {
  const found = await failures(
    style10,
    page('---', 'title: "Prism"', '---', '', '# Prism', '', 'Prose.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].item, /^style-10 @ line 5$/);
});

test('style-10 compares titles ignoring markup and case', async () => {
  const found = await failures(
    style10,
    page('---', 'title: "Prism"', '---', '', '## `prism`', '', 'Prose.', ''),
  );
  assert.equal(found.length, 1);
});

test('style-11 flags a level-1 body heading that is not the title', async () => {
  const found = await failures(
    style11,
    page('---', 'title: "Prism"', '---', '', '# Something Else', '', 'Prose.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].issue ?? '', /body headings start at/);
});

test('style-11 leaves a title-repeating h1 to style-10', async () => {
  // One line must not draw two differently-worded complaints.
  const duplicate = page('---', 'title: "Prism"', '---', '', '# Prism', '', 'Prose.', '');
  assert.deepEqual(await failures(style11, duplicate), []);
  assert.equal((await failures(style10, duplicate)).length, 1);
});

test('style-11 flags a skipped heading level', async () => {
  const found = await failures(
    style11,
    page('## Overview', '', 'Prose.', '', '#### Too Deep', '', 'More prose.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].issue ?? '', /jumps from "##" to "####"/);
});

test('style-12 flags a heading stacked straight onto its subheading', async () => {
  const found = await failures(
    style12,
    page('## Overview', '', '### Creating a Prism', '', 'Prose.', ''),
  );
  assert.equal(found.length, 1);
  assert.match(found[0].item, /^style-12 @ line 1$/);
});

test('style-12 ignores two headings at the same level', async () => {
  // An empty section is a different problem; this rule is about nesting only.
  const found = await failures(style12, page('## First', '', '## Second', '', 'Prose.', ''));
  assert.deepEqual(found, []);
});
