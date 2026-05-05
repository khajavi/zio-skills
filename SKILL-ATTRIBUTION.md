# Skill Attribution Hook

The ZIO skills plugin includes an optional git post-commit hook that automatically tracks which skills were used in each commit and includes their versions in commit messages.

## Installation

### Quick Setup

Run the setup script from the repository root:

```bash
bash setup-skill-hook.sh
```

This will:
- ✅ Install the hook to `.git/hooks/post-commit`
- ✅ Make it executable
- ✅ Preserve any existing hook (with confirmation)

### Manual Setup

If you prefer to set up manually:

1. Copy the hook template:
```bash
cp plugins/zio-skills/.claude-plugin/post-commit.template .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

2. Verify it works by making a commit:
```bash
echo "test" > file.txt
git add file.txt
git commit -m "test: verify hook"
git log -1 --pretty=%B  # Should show Skills-Used trailer
```

## How It Works

When you commit code using ZIO skills:

1. The hook detects all installed plugins in the `plugins/` directory
2. Extracts the plugin name and version from each `plugin.json`
3. Updates versions to include the commit hash (e.g., `0.1.0-abc1234`)
4. Appends a `Skills-Used` trailer to your commit message

## Example

**Before hook:**
```
feat: add OpenAPI validation
```

**After hook:**
```
feat: add OpenAPI validation

Skills-Used: zio-http-scaffold@0.1.0-abc1234,docs-write@0.1.0-abc1234
```

## Uninstalling

To remove the hook:

```bash
rm .git/hooks/post-commit
```

If you have other hooks installed, you may need to manually remove just the skill attribution code.

## Troubleshooting

### Hook not running?

1. Verify it's executable:
```bash
ls -la .git/hooks/post-commit
# Should show: -rwxr-xr-x
```

2. Check for errors:
```bash
bash -n .git/hooks/post-commit  # Check syntax
bash .git/hooks/post-commit      # Run manually
```

### Missing `jq` dependency?

The hook uses `jq` to parse JSON. Install it:

```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# Other systems
https://jqlang.github.io/jq/download/
```

### Want to skip the hook for a commit?

```bash
git commit --no-verify -m "your message"
```

## Customize

To customize which plugins are tracked or modify the trailer format, edit `.git/hooks/post-commit` directly.

The hook is auto-generated from `plugins/zio-skills/.claude-plugin/post-commit.template`, so you can also restore the original by re-running `bash setup-skill-hook.sh`.
