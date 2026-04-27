# Modular Plugin Architecture — Future Plan

**Status:** Planned (Future Phase)  
**Current Approach:** Monolithic `zio-skills` plugin  
**Target Approach:** Modular plugins with meta-bundle

---

## Overview

This document outlines the plan to evolve from a single monolithic `zio-skills` plugin to a modular architecture where each ZIO ecosystem library has its own focused plugin, with an optional bundler for users who want the full ecosystem.

## Current State (Phase 1)

**Single Plugin Model:**
- `zio-skills` — All ZIO HTTP skills in one plugin
- Users get all skills even if they only need one library
- Simpler maintenance and versioning initially
- Single marketplace entry

**Pros:**
- Single installation point
- Centralized maintenance
- Easier version management

**Cons:**
- Bloats context for users needing only specific skills
- All skills must version together
- Issues in one skill affect entire plugin
- Harder to scale as ZIO ecosystem grows

---

## Target State (Phase 2)

**Modular Plugin Model with Dependencies:**

Individual plugins per ZIO library:
- `zio-http-skills` — HTTP server/client patterns
- `zio-streams-skills` — Stream composition and operators
- `zio-config-skills` — Configuration management patterns
- `zio-schema-skills` — Schema and serialization patterns
- `zio-sql-skills` — Database access patterns
- `zio-logging-skills` — Structured logging patterns
- `zio-cache-skills` — Caching strategies
- *...and more*

Meta-plugin bundler:
- `zio-skills` — Declares all plugins as dependencies
- Users can install just the bundler → all plugins install automatically
- Or install individual plugins as needed

**Repository Structure:**
```
zio-skills/
├── .claude-plugin/
│   ├── marketplace.json              (lists all plugins)
│   ├── plugin.json                   (meta-plugin with dependencies)
│   ├── zio-http/plugin.json
│   ├── zio-streams/plugin.json
│   ├── zio-config/plugin.json
│   ├── zio-schema/plugin.json
│   └── ...
├── skills/
│   ├── zio-http-*/
│   ├── zio-streams-*/
│   ├── zio-config-*/
│   └── ...
└── package.json
```

**Installation Experience:**

Option 1: Install entire ecosystem
```bash
claude plugin install zio-skills@marketplace
# Automatically installs: zio-http-skills, zio-streams-skills, zio-config-skills, ...
```

Option 2: Install specific library
```bash
claude plugin install zio-http-skills@marketplace
```

**Pros:**
- Users only install what they need
- Independent versioning per library
- Clear scope boundaries
- Scales to 10+ ZIO libraries
- Better discoverability ("I want zio-http" → install `zio-http-skills`)
- Leverages Claude Code's built-in dependency resolution

**Cons:**
- More manifest files to maintain
- Multiple plugin entries in marketplace

---

## Implementation Roadmap

### Phase 1 (Current) ✅
- [x] Publish 4 ZIO HTTP skills under single `zio-skills` plugin
- [x] Establish project structure and contribution guidelines
- [x] Verify plugin works on Claude Code, Cursor, Codex, Gemini CLI
- [x] Publish to Anthropic marketplace (future step)

### Phase 2 (Future)
- [ ] Create individual plugin manifests:
  - [ ] `.claude-plugin/zio-http/plugin.json`
  - [ ] `.claude-plugin/zio-streams/plugin.json`
  - [ ] `.claude-plugin/zio-config/plugin.json`
  - [ ] `.claude-plugin/zio-schema/plugin.json`
  - [ ] etc.

- [ ] Update marketplace.json to list all plugins with their source paths

- [ ] Create meta-plugin manifest (`.claude-plugin/plugin.json`) that declares dependencies on all individual plugins

- [ ] Move existing HTTP skills to `zio-http/` directory structure

- [ ] Add new skills for Streams, Config, Schema as they're created

- [ ] Test dependency resolution:
  - [ ] Install meta-plugin → verify all dependencies install
  - [ ] Install individual plugin → verify standalone installation
  - [ ] Test on Claude Code, Cursor, Codex, Gemini CLI

- [ ] Update documentation and README with new installation options

- [ ] Publish each plugin independently to marketplace

### Phase 3 (Future)
- [ ] Expand skills coverage across ZIO ecosystem
- [ ] Consider transferring repo to `zio/` organization
- [ ] Establish community contribution guidelines for new library skills

---

## Migration Path

When Phase 2 is ready, existing `zio-skills` users won't be affected:
- Current `zio-skills` plugin continues to work
- New installations can use individual plugins or the meta-bundler
- Automatic dependency resolution handles the transition

---

## Decision Rationale

The modular approach with plugin dependencies was chosen because:

1. **Aligns with industry standards** — npm, Go modules, Rust crates all follow modular patterns
2. **Respects user control** — users only get what they need
3. **Leverages Claude Code's architecture** — plugin dependencies are a built-in feature
4. **Future-proof** — scales as ZIO ecosystem grows
5. **No UI overhead** — automatic dependency resolution, no checkboxes needed
6. **Backwards compatible** — can migrate gradually

---

## Related Issues / PRs

- Link to marketplace registration PR (when Phase 2 begins)
- Link to individual plugin PRs (when created)

---

## References

- Claude Code Plugins Reference: https://code.claude.com/docs/en/plugins-reference
- Plugin Dependencies Feature: https://github.com/anthropics/claude-code/issues/9444
- Current repository: https://github.com/khajavi/zio-skills
