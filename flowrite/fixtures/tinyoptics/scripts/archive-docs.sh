#!/usr/bin/env bash
#
# archive-docs.sh — snapshot everything a write-tutorial run generated in this
# fixture, then reset the fixture to its committed baseline (git-stash semantics).
#
# Captures ALL changes vs committed HEAD (docs, src/main/scala/examples/*,
# build.sbt, project/plugins.sbt, sidebars.js, EXAMPLES_SUMMARY.md, ...) as one
# patch under archive/write-tutorial-turn<N>/, copies generated guide markdown as
# readable files, then restores the working tree. Ignored paths (website/
# node_modules & .docusaurus, archive/, .remember/) are left untouched.
#
# Usage: bash scripts/archive-docs.sh
set -euo pipefail

# Fixture root = parent of this script's directory.
cd "$(dirname "$0")/.."
fixture_root="$(pwd)"

# Next turn number.
n=1
while [ -e "archive/write-tutorial-turn$n" ]; do
  n=$((n + 1))
done
dest="archive/write-tutorial-turn$n"
mkdir -p "$dest"

# 1. Whole-fixture patch vs HEAD. `add -N` makes untracked files show in the diff;
#    .gitignore keeps node_modules/.docusaurus/archive/.remember out.
git add -N -- .
git diff HEAD -- . > "$dest/changes.patch"
git reset -q -- .

if [ ! -s "$dest/changes.patch" ]; then
  rm -rf "$dest"
  echo "no changes to archive; fixture already at baseline"
  exit 0
fi

# 2. Copy generated (untracked) doc markdown as readable files alongside the patch.
doc_count=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  mkdir -p "$dest/$(dirname "$f")"
  cp "$f" "$dest/$f"
  doc_count=$((doc_count + 1))
done < <(git ls-files --others --exclude-standard -- docs)

# 3. Reset the fixture to committed baseline (stash-like).
git reset -q -- .
git checkout -- .
git clean -fdq -e archive -- .

changed="$(grep -c '^diff --git' "$dest/changes.patch" || true)"
echo "archived turn $n: $changed file(s) changed, $doc_count generated doc(s) copied -> $dest"
echo "fixture reset to HEAD. replay with: git apply $dest/changes.patch"
