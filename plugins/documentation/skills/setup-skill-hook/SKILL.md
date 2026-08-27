---
name: setup-skill-hook
description: Use this skill once to automatically install the ZIO skill attribution hook. After installation, all commits will automatically track which skills were used and include their versions.
tags: [zio, setup, git, hook, skills, installation]
---

# Install Skill Attribution Hook

Use this skill once to set up automatic skill attribution tracking in your commits.

## What This Does

Installs a git post-commit hook that:
- ✅ Auto-discovers all installed ZIO plugins
- ✅ Updates plugin versions with commit hashes
- ✅ Appends a `Skills-Used` trailer to every commit message
- ✅ Tracks which skills contributed to each change

## One-Time Setup

Simply invoke this skill:

```
/setup-skill-hook
```

The skill will:
1. Locate the hook template in the installed plugin
2. Copy it to your `.git/hooks/post-commit`
3. Make it executable
4. Verify installation with a test commit

## After Installation

Every commit will automatically include:

```
feat: add OpenAPI validation

Skills-Used: zio-http-scaffold@0.1.0-abc1234,docs-data-type-ref@0.1.0-abc1234
```

This makes it easy to:
- 📊 Track which skills were used in each change
- 🔍 Reference exact skill versions by commit hash
- 📝 Document skill usage in your project history
- 🔗 Link commits to specific skill capabilities

## Manual Alternative

If you prefer, you can also run from the repository root:

```bash
bash setup-skill-hook.sh
```

## Uninstall

To remove the hook anytime:

```bash
rm .git/hooks/post-commit
```

## Notes

- The hook runs automatically on every commit
- Use `git commit --no-verify` to skip the hook for a single commit
- The hook requires `jq` to be installed (for JSON parsing)
- If `jq` is missing, install it: `brew install jq` (macOS) or `sudo apt-get install jq` (Linux)
