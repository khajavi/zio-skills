# ZIO Skills Project Instructions

## Skill Attribution Hook

This project includes automatic skill attribution tracking. When you use ZIO skills (like `zio-http-scaffold` or `docs-write`), the git hook automatically:

- Updates plugin versions with commit hashes
- Tracks which skills were used in each commit
- Adds a `Skills-Used` trailer to commit messages

### First-Time Setup

Before making commits, run this skill once:

```
/setup-skill-hook
```

This installs the git post-commit hook. After that, it runs automatically on every commit.

### Example

Your commits will show:

```
feat: add OpenAPI validation

Skills-Used: zio-http-scaffold@0.1.0-abc1234,docs-write@0.1.0-abc1234
```

### Manual Installation

If you prefer, you can also run:

```bash
bash setup-skill-hook.sh
```

### Learn More

See [SKILL-ATTRIBUTION.md](SKILL-ATTRIBUTION.md) for complete documentation.
