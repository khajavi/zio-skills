// The research cache, including the one-at-a-time migration off the pre-SQLite JSON files.
//
// Worth testing where the JSON version was not: a cache that silently misses costs a real
// re-research (measured around $0.33 for a data-type run), and a cache that silently hits with the
// wrong entry poisons a whole page. Both are invisible in a run log until the page is wrong.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { listResearchCache, readResearchCache, writeResearchCache } from './research-cache.ts';

/** A throwaway checkout root. Each test gets its own, so the module's handle map cannot leak between. */
const repo = () => mkdtempSync(path.join(tmpdir(), 'flowrite-cache-'));

/** Write a legacy entry exactly where the JSON cache would have put it. */
function seedLegacy(repoPath: string, topic: string, data: unknown): string {
  const key = createHash('sha256').update(`${repoPath}::${topic}`).digest('hex');
  const file = path.join(repoPath, '.flowrite', 'cache', 'research', `${key}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return file;
}

test('a miss is null, and does not create a phantom entry', () => {
  const dir = repo();
  assert.equal(readResearchCache(dir, 'data-type-ref::Prism'), null);
  assert.deepEqual(listResearchCache(dir), []);
});

test('what goes in comes back out', () => {
  const dir = repo();
  const research = { typeName: 'Prism', constructors: [{ name: 'Prism.apply' }], nested: { deep: [1, 2] } };
  writeResearchCache(dir, 'data-type-ref::Prism', research);
  assert.deepEqual(readResearchCache(dir, 'data-type-ref::Prism'), research);
});

test('the same name under two document kinds does not collide', () => {
  // This is the property the topic prefixes exist for: a module run and a data-type run for one name
  // hold different schemas, and one overwriting the other would feed a page the wrong shape.
  const dir = repo();
  writeResearchCache(dir, 'data-type-ref::optics', { typeName: 'optics' });
  writeResearchCache(dir, 'module-ref::optics', { moduleName: 'optics' });
  assert.deepEqual(readResearchCache(dir, 'data-type-ref::optics'), { typeName: 'optics' });
  assert.deepEqual(readResearchCache(dir, 'module-ref::optics'), { moduleName: 'optics' });
});

test('a second write replaces the first rather than failing on the primary key', () => {
  const dir = repo();
  writeResearchCache(dir, 'data-type-ref::Prism', { role: 'first' });
  writeResearchCache(dir, 'data-type-ref::Prism', { role: 'second' });
  assert.deepEqual(readResearchCache(dir, 'data-type-ref::Prism'), { role: 'second' });
  assert.equal(listResearchCache(dir).length, 1);
});

test('a legacy JSON entry is read, carried into the database, and its file removed', () => {
  const dir = repo();
  const legacy = seedLegacy(dir, 'data-type-ref::Prism', { role: 'from the old cache' });

  assert.deepEqual(readResearchCache(dir, 'data-type-ref::Prism'), { role: 'from the old cache' });
  assert.equal(existsSync(legacy), false, 'the migrated file should not be left behind to be read twice');
  // The point of the migration: the second read comes from SQLite, with the file already gone.
  assert.deepEqual(readResearchCache(dir, 'data-type-ref::Prism'), { role: 'from the old cache' });
  assert.deepEqual(
    listResearchCache(dir).map((e) => e.topic),
    ['data-type-ref::Prism'],
  );
});

test('a corrupt legacy file is a miss, not a crash', () => {
  // A truncated JSON file is what a killed run leaves behind, and a re-research is the right answer.
  const dir = repo();
  const key = createHash('sha256').update(`${dir}::data-type-ref::Prism`).digest('hex');
  const file = path.join(dir, '.flowrite', 'cache', 'research', `${key}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '{"typeName": "Pri');

  assert.equal(readResearchCache(dir, 'data-type-ref::Prism'), null);
});

test('the database is created under .flowrite/cache, not at the checkout root', () => {
  const dir = repo();
  writeResearchCache(dir, 'data-type-ref::Prism', {});
  assert.ok(existsSync(path.join(dir, '.flowrite', 'cache', 'research.db')));
});
