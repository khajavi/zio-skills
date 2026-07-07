#!/usr/bin/env bash
#
# archive-docs.sh — snapshot everything a write-tutorial run generated in this
# fixture, then reset the fixture to its committed baseline (git-stash semantics).
#
# Captures ALL changes vs committed HEAD (docs, src/main/scala/examples/*,
# build.sbt, project/plugins.sbt, sidebars.js, EXAMPLES_SUMMARY.md, ...) as one
# patch under ../tinyoptics-archive/write-tutorial-turn<N>/changes.patch, AND
# writes two full, standalone, runnable project copies alongside it:
#   tinyoptics-base/  — committed HEAD, unmodified (what the run started from)
#   tinyoptics-final/ — HEAD + this run's changes merged (what the run produced)
# Both are complete trees (tracked + untracked, .gitignore-respecting) — cd
# into either and run sbt directly. A diff-only copy would be missing
# unchanged baseline files like project/plugins.sbt and can't build.
# Then restores the working tree. Ignored paths (website/ node_modules &
# .docusaurus, .remember/) are left untouched.
#
# Usage: bash scripts/archive-docs.sh [flue-run-log-file]
#   If a log file path is given (and exists), it's copied into the archived
#   turn as flue.log — even on a failed/partial run with no file changes.
set -euo pipefail

log_file="${1:-}"

# Fixture root = parent of this script's directory.
cd "$(dirname "$0")/.."

# Archive lives one level up, alongside the fixture (not inside it).
archive_root="../tinyoptics-archive"
mkdir -p "$archive_root"

# Next turn number.
n=1
while [ -e "$archive_root/write-tutorial-turn$n" ]; do
  n=$((n + 1))
done
dest="$archive_root/write-tutorial-turn$n"
mkdir -p "$dest"

if [ -n "$log_file" ] && [ -f "$log_file" ]; then
  cp "$log_file" "$dest/flue.log"
fi

# 1. Whole-fixture patch vs HEAD. `add -N` makes untracked files show in the diff;
#    .gitignore keeps node_modules/.docusaurus/.remember out.
git add -N -- .
git diff HEAD -- . > "$dest/changes.patch"
git reset -q -- .

if [ ! -s "$dest/changes.patch" ]; then
  rm -f "$dest/changes.patch"
  if [ -e "$dest/flue.log" ]; then
    echo "no file changes; log saved to $dest/flue.log"
  else
    rm -rf "$dest"
    echo "no changes to archive; fixture already at baseline"
  fi
  exit 0
fi

# Copy every file in the current working tree (tracked + untracked,
# .gitignore-respecting) into $2, mirroring the fixture tree.
copy_tree() {
  local into="$1"
  local count=0
  local list
  list="$(mktemp)"
  {
    git ls-files -- .                              # tracked files
    git ls-files --others --exclude-standard -- .  # untracked files
  } | sort -u > "$list"
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    mkdir -p "$into/$(dirname "$f")"
    cp "$f" "$into/$f"
    count=$((count + 1))
  done < "$list"
  rm -f "$list"
  echo "$count"
}

# 2. Copy the final tree (baseline + this run's changes still merged in) before
#    resetting anything.
final_count="$(copy_tree "$dest/tinyoptics-final")"

# 3. Reset the fixture to committed baseline (stash-like), then copy that
#    clean baseline tree too, for side-by-side comparison and a from-scratch
#    runnable project.
git reset -q -- .
git checkout -- .
git clean -fdq -- .
base_count="$(copy_tree "$dest/tinyoptics-base")"

changed="$(grep -c '^diff --git' "$dest/changes.patch" || true)"
log_note=""
[ -e "$dest/flue.log" ] && log_note=", log saved to $dest/flue.log"
echo "archived turn $n: $changed file(s) changed. $base_count file(s) in $dest/tinyoptics-base/, $final_count file(s) in $dest/tinyoptics-final/$log_note"
echo "fixture reset to HEAD. Both copies are standalone runnable projects (cd in, run sbt). Or replay the diff onto this fixture: git apply $dest/changes.patch"
