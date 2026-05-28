#!/bin/bash
# Setup script for zio-skills post-commit hook
# This script installs the skill attribution hook to track which skills were used in each commit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_TEMPLATE="$SCRIPT_DIR/plugins/zio-skills/.claude-plugin/post-commit.template"
HOOK_TARGET=".git/hooks/post-commit"

if [ ! -f "$HOOK_TEMPLATE" ]; then
  echo "❌ Error: post-commit.template not found at $HOOK_TEMPLATE"
  echo "Make sure you're running this script from the zio-skills repository root"
  exit 1
fi

if [ ! -d ".git" ]; then
  echo "❌ Error: This doesn't appear to be a git repository"
  echo "Please run this script from the root of your git repository"
  exit 1
fi

# Check if hook already exists
if [ -f "$HOOK_TARGET" ]; then
  echo "⚠️  Hook already exists at $HOOK_TARGET"
  read -p "Do you want to replace it? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "✓ Skipped"
    exit 0
  fi
fi

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy hook template
cp "$HOOK_TEMPLATE" "$HOOK_TARGET"
chmod +x "$HOOK_TARGET"

echo "✅ Skill attribution hook installed successfully!"
echo ""
echo "📝 What it does:"
echo "  - Tracks which ZIO skills were used in each commit"
echo "  - Updates plugin versions with commit hashes"
echo "  - Adds 'Skills-Used' trailer to commit messages"
echo ""
echo "Example commit message:"
echo "  feat: add OpenAPI validation"
echo "  "
echo "  Skills-Used: zio-knowledge@0.1.0-abc1234,docs-write@0.1.0-abc1234"
echo ""
echo "💡 The hook runs automatically on every commit."
