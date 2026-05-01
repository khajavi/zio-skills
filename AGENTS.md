# ZIO Skills — Contributor Guidelines

## For AI Agents

This repo is a Claude Code marketplace (`ziogenetics`) containing two plugins:

- **`zio-skills`** (`plugins/zio-skills/`) — building ZIO and ZIO HTTP applications
- **`documentation`** (`plugins/documentation/`) — writing documentation for ZIO libraries

Before modifying any SKILL.md file or adding a new skill:

1. **Understand the pattern** — Read an existing skill like `plugins/zio-skills/skills/zio-http-scaffold/SKILL.md` to understand the structure and tone.
2. **Test your skill** — If you're modifying or creating a skill, verify:
   - The YAML frontmatter is valid (name, description, tags)
   - Code examples compile against the stated dependencies
   - Trigger conditions in `description` are clear and match real user requests
   - The skill teaches the agent WHEN and HOW to use the feature, not just WHAT it is
3. **Reference existing examples** — Skills link to concrete examples in the zio-http repo where applicable.
4. **Keep it actionable** — A good skill helps an agent write correct, idiomatic Scala code. Vague or incomplete guidance wastes the agent's context.

## For Humans

Contributing skills is welcome. Open a PR with:
- A new `plugins/<plugin>/skills/<skill-name>/SKILL.md` file
- A brief description of what it teaches
- References to working examples in the relevant ZIO library repo
- Testing notes (did you validate with an agent?)

ZIO skills are long-term learning resources that agents will invoke thousands of times. Quality matters.
