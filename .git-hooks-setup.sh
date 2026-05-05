#!/bin/bash
# One-time setup: Configure git to use .git-hooks/ for hooks
# After running this, hooks will be automatically used without any .git/hooks/ copying

set -e

if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Configure git to use .git-hooks/ directory
git config core.hooksPath .git-hooks

echo "✅ Git configured to use .git-hooks/"
echo "✓ Skill attribution hook is now active"
echo "✓ No .git/hooks/ copying needed"
echo ""
echo "Next commit will automatically include Skills-Used trailer!"
