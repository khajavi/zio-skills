---
name: write-developer-skill
description: Use when asked to write, create, or add a new developer skill for a ZIO library (zio-streams, zio-config, zio-schema, etc.). Guides you step-by-step from library research to verified, production-ready SKILL.md files that teach agents how to use the library correctly.
tags: [zio, skills, meta, authoring, code-generation, developer-experience]
---

# Write Developer Skills for ZIO Libraries

## Use this skill when

- **Writing** a new skill for a ZIO library like `zio-streams`, `zio-config`, `zio-schema`, `zio-logging`
- **Creating** developer skills from scratch for any `dev.zio::<library>`
- **Adding** skills to the `zio-skills` plugin repository
- **Documenting** common patterns from a ZIO library as reusable teaching guides
- **Extending** zio-skills coverage to new libraries beyond `zio-http`

## Overview

This skill teaches a 6-step workflow to create production-ready developer skills for any ZIO library. It transforms raw library knowledge into structured, agent-friendly skill files that follow the proven pattern established by the 4 ZIO HTTP skills.

**Key outcome:** 1-4 SKILL.md files that teach agents WHEN and HOW to use a library pattern, complete with working code examples verified to compile and run.

### Where Skills Live (Distributed Architecture)

Skills are **maintained in each library's source repo**, not in a central registry:

```
zio/zio-http/docs/skills/          ← Maintained by zio-http team
├── zio-http-scaffold/
│   └── SKILL.md
├── zio-http-openapi-to-endpoint/
│   └── SKILL.md
└── ...

zio/zio-streams/docs/skills/       ← Maintained by zio-streams team (future)
├── zio-streams-consume/
│   └── SKILL.md
└── ...

zio/zio-skills/skills/             ← Auto-generated from npm packages
├── zio-http-scaffold/             (copied from @zio.dev/zio-http)
├── zio-streams-consume/           (copied from @zio.dev/zio-streams)
└── ...
```

**How it works:**
1. Library teams create/update skills in `<lib>/docs/skills/` within their own repo
2. At release time, skills are published to npm as `@zio.dev/<lib>`
3. Renovate bot in `zio/zio-skills` detects new versions and auto-syncs skills
4. Central registry is always in sync with the latest library release

This ensures skills are always up-to-date because library maintainers update them when APIs change.

---

## Step 1 — Gather Library Information

Before writing any skills, collect the foundational library metadata.

### What to gather

For the library you're targeting (e.g., `zio-streams`):

| Item | Example | Where to find |
|---|---|---|
| **Library name** | `zio-streams` | `https://github.com/zio/<lib-name>` |
| **Latest version** | `3.1.6` | Maven Central or `build.sbt` in repo |
| **Maven artifact** | `"dev.zio" %% "zio-streams" % "3.1.6"` | Maven Central search |
| **GitHub repo** | `https://github.com/zio/zio-streams` | zio org on GitHub |
| **Examples path** | `zio-streams-examples/` or `docs/` | Browse repo root |
| **Key modules** | `zio-streams`, `zio-streams-kafka` | Check `build.sbt` in repo |
| **Scaladoc** | `https://javadoc.io/doc/dev.zio/zio-streams_3/` | javadoc.io (adjust version) |

### Concrete command to list examples

```bash
# If the ZIO library is cloned locally
find /path/to/<lib> -name "*.scala" -path "*/example*" | head -20

# Or browse on GitHub
# https://github.com/zio/<lib-name>/tree/main/<lib-name>-examples
```

**Why this matters:** Knowing the exact artifact name, version, and examples directory prevents copy-paste errors in SKILL.md code blocks.

---

## Step 2 — Study the Library

Read the source code and identify the core patterns worth teaching.

### Concrete exploration tasks

#### Task 1: Find and read example files
```bash
find /path/to/<lib> -name "*Example*.scala" -o -name "*example*.scala" \
  | xargs head -100
```

For each example, note:
- What imports are used
- Which 3-5 API types are called
- What is the "before → after" change it demonstrates

#### Task 2: Read README and design docs
- `README.md` — explains the library's purpose in 1-2 sentences
- `docs/` or `doc/` directory — design patterns, common tasks
- Look for sections like "Getting Started", "Examples", "API Overview"

#### Task 3: Identify top-level public API
```bash
# List all top-level public objects and traits
grep "^object\|^trait\|^class" /path/to/<lib>/src/main/scala/*.scala | head -20
```

Focus on: **What types do ALL examples import and use?** These are the "core" of the library.

#### Task 4: Find "must teach" patterns
Scan all examples and note which API patterns repeat in 3+ examples. **This is your skill trigger phrase candidate.**

Example for `zio-streams`:
- Pattern: "Create a stream from a list" (appears in 5+ examples)
  - API: `ZStream.fromIterable(List(...))`
  - Trigger: "create a stream", "iterate over a collection"

### Decision rule

**A pattern deserves its own SKILL.md if:**
- It appears in 3+ examples, OR
- A user would naturally ask 3+ trigger phrase variations about it, OR
- It's a prerequisite for understanding other patterns

**Example trigger variations for `zio-config` loading:**
- "Load configuration from HOCON"
- "Read application.conf"
- "Parse config with type safety"

All three → one `zio-config-load` skill.

---

## Step 3 — Plan Your Skill Set

Name and outline each skill before writing it.

### Skill naming convention

```
<lib-short>-<feature>
```

Examples:
- `zio-streams-consume` — read from a stream
- `zio-config-load` — load HOCON configuration
- `zio-schema-derive` — auto-derive Schema for a type
- `zio-logging-setup` — initialize structured logging

**All skills remain flat in the `skills/` directory,** not nested by library. Names are self-documenting via prefix.

### For each planned skill, define a planning table

| Field | Value |
|---|---|
| **Skill name** | `zio-<lib>-<feature>` |
| **Trigger phrases** | 3+ user questions that would invoke this |
| **What it teaches** | 1-2 sentences on the core pattern |
| **Core API types** | 4-6 main types/methods from the library |
| **Reference file** | GitHub path to a working example |
| **Dependencies** | Exact `build.sbt` line(s) needed |
| **Prerequisite skills** | Other skills that should be read first |

### Example: zio-config-load skill plan

| Field | Value |
|---|---|
| **Skill name** | `zio-config-load` |
| **Trigger phrases** | "Load configuration from HOCON", "Read application.conf", "Parse config file" |
| **What it teaches** | How to load and parse HOCON configuration files using `zio-config` with type-safe accessors. |
| **Core API types** | `ConfigProvider.fromHocon`, `Config.int`, `Config.string`, `ZConfig` |
| **Reference file** | `zio-config-examples/src/main/scala/zio/config/examples/hocon/HoconExample.scala` |
| **Dependencies** | `"dev.zio" %% "zio-config" % "..."`, `"dev.zio" %% "zio-config-typesafe" % "..."` |
| **Prerequisite skills** | None |

---

## Step 4 — Write Each SKILL.md File

Use the canonical template proven by the 4 ZIO HTTP skills.

### Directory structure for each skill

Skills are created in the **library's own source repo**, not in zio-skills:

```
zio/<lib-name>/docs/skills/
└── <lib-short>-<feature>/
    └── SKILL.md
```

**Example for zio-http:**
```
zio/zio-http/docs/skills/
├── zio-http-scaffold/SKILL.md
├── zio-http-openapi-to-endpoint/SKILL.md
├── zio-http-endpoint-to-openapi/SKILL.md
└── zio-http-imperative-to-declarative/SKILL.md
```

**Example for zio-config (future):**
```
zio/zio-config/docs/skills/
├── zio-config-load/SKILL.md
├── zio-config-typesafe/SKILL.md
└── zio-config-validate/SKILL.md
```

The central `zio/zio-skills` registry will auto-extract these during npm package publish.

### Template: SKILL.md structure

Copy this template and fill in the `{{PLACEHOLDERS}}`:

```markdown
---
name: {{SKILL_NAME}}
description: Use when asked to {{TRIGGER_PHRASE_1}}, {{TRIGGER_PHRASE_2}}, or {{TRIGGER_PHRASE_3}}. {{ONE_SENTENCE_SUMMARY}}.
tags: [zio, {{LIB_NAME}}, scala]
---

# {{ACTION_TITLE}}

## Use this skill when

- **{{Verb}}** {{trigger phrase 1}}
- **{{Verb}}** {{trigger phrase 2}}
- **{{Verb}}** {{trigger phrase 3}}

For example:
- "{{Example user question 1}}"
- "{{Example user question 2}}"

## Step 1 — Add Dependencies

Add to your `build.sbt`:

\`\`\`scala
libraryDependencies ++= Seq(
  "dev.zio" %% "{{ARTIFACT_1}}" % "{{VERSION}}"{{,}}
  "dev.zio" %% "{{ARTIFACT_2}}" % "{{VERSION}}"
)
\`\`\`

**Why:** {{Brief explanation of what each dependency provides}}

## Step 2 — {{First Core Pattern}}

\`\`\`scala
import zio._
import {{LIB_PACKAGE}}._

// Self-contained, runnable example
// (copy-paste friendly)

object {{ExampleName}} extends ZIOAppDefault {
  def run = for {
    // ... 
  } yield ()
}
\`\`\`

> **Key types:**
> - `{{Type1}}` — {{what it does}}
> - `{{Type2}}` — {{what it does}}

{{Brief explanation of the code block above}}

## Step 3 — {{Second Core Pattern}}

\`\`\`scala
// Another concrete, working example
\`\`\`

> **Key types:**
> - `{{Type3}}` — {{what it does}}

## Step N — {{Nth Pattern}}

{{As many steps as needed — typically 3-5}}

## Advanced Patterns

### Pattern: {{Advanced variant}}

\`\`\`scala
// More sophisticated example showing optional/advanced API
\`\`\`

## Key Types Quick Reference

| Type / Method | Purpose |
|---|---|
| `{{Type}}` | {{What it does and when to use it}} |
| `{{Method}}(...)` | {{Parameter hints and return value}} |

## Common Mistakes

- **Mistake 1**: {{Description}} → {{How to fix}}
- **Mistake 2**: {{Description}} → {{How to fix}}

## Next Steps

- See `{{OTHER_SKILL_NAME}}` for {{how it builds on this}}
- Read the [Scaladoc]({{SCALADOC_URL}}) for advanced API reference
- Check the [source examples]({{GITHUB_EXAMPLES_URL}}) for more patterns

## References

- **Source examples**: [{{LIB_NAME}}/tree/main/...](https://github.com/zio/{{LIB_NAME}}/tree/main/{{EXAMPLES_PATH}})
- **Scaladoc**: [javadoc.io](https://javadoc.io/doc/dev.zio/{{ARTIFACT}}_3/latest/{{PACKAGE}}/index.html)
- **GitHub**: [zio/{{LIB_NAME}}](https://github.com/zio/{{LIB_NAME}})
- **ZIO Docs**: [zio.dev](https://zio.dev)
```

### Concrete example: zio-config-load SKILL.md (partial)

See existing `skills/zio-http-scaffold/SKILL.md` for a working reference. Your `zio-config-load/SKILL.md` would follow the identical structure but with:

- **name:** `zio-config-load`
- **description:** "Use when asked to load configuration from HOCON, read application.conf, or parse config files. Shows type-safe configuration loading with zio-config."
- **Trigger verbs:** "Load", "Read", "Parse"
- **Step 1 code:** How to add `zio-config` + `zio-config-typesafe` to `build.sbt`
- **Step 2 code:** Minimal example loading a HOCON file and accessing a value
- **Step 3 code:** How to access nested config values with dot notation
- **Key types:** `ConfigProvider`, `Config[T]`, `ZConfig`

---

## Step 5 — Verify Code Compiles (Phase 3)

Confirm all code examples actually compile against real dependencies by creating a clean, isolated test project.

### Procedure

#### 1. Create a temporary test project directory

```bash
TEMP_PROJECT="/tmp/zio-skill-verify-<lib-name>"
mkdir -p "$TEMP_PROJECT/src/main/scala"
cd "$TEMP_PROJECT"
```

#### 2. Create `build.sbt`

```scala
// build.sbt
name := "skill-verify"
version := "0.1.0"
scalaVersion := "2.13.13"

libraryDependencies ++= Seq(
  "dev.zio" %% "zio" % "2.1.25",
  "dev.zio" %% "{{ARTIFACT_1}}" % "{{VERSION}}",
  "dev.zio" %% "{{ARTIFACT_2}}" % "{{VERSION}}"  // Add all your skill dependencies
)
```

#### 3. Create test Scala files

For each skill, create a separate verification file:

```bash
# For skill: zio-config-load
cat > src/main/scala/SkillVerificationZioConfig.scala << 'EOF'
import zio._
import zio.config._

// Copy code from Step 2 of zio-config-load SKILL.md
object VerifyZioConfigLoad {
  // Top-level vals/objects (not inside a class)
  val example1 = ConfigProvider.fromHocon
  
  // Skill code here...
}
EOF
```

Do this for each skill you're testing. One file per skill.

#### 4. Compile with sbt

```bash
cd "$TEMP_PROJECT"
sbt compile
```

#### 5. Check for success

```bash
ls -la target/scala-2.13/classes/SkillVerification*.class
```

If files exist: ✅ **Compilation succeeded**

#### 6. Handle compilation errors

If `sbt compile` fails:

```
[error] /tmp/zio-skill-verify-config/src/main/scala/SkillVerificationZioConfig.scala:5:10
[error] not found: value ConfigProvider
```

**Fix process:**
1. Read the error carefully (missing import, wrong type, API changed)
2. Check [Scaladoc](https://javadoc.io/doc/dev.zio/) for correct API
3. Update your SKILL.md code block to match the actual library API
4. Fix the test file and re-run `sbt compile`
5. Repeat until all skills compile

Common issues:
- **Missing import**: Add `import zio.<module>._` to the test file
- **Wrong artifact name**: Verify Maven coordinates on [mvnrepository.com](https://mvnrepository.com)
- **Version mismatch**: Check that `build.sbt` version matches your skill documentation
- **Deprecated API**: Check GitHub issues or Scaladoc for the new API name

#### 7. Clean up

```bash
rm -rf "$TEMP_PROJECT"
```

### Example: Full test for zio-config-load

```bash
# Create project
mkdir -p /tmp/zio-skill-verify-config/src/main/scala
cd /tmp/zio-skill-verify-config

# Create build.sbt
cat > build.sbt << 'EOF'
name := "skill-verify"
scalaVersion := "2.13.13"
libraryDependencies ++= Seq(
  "dev.zio" %% "zio" % "2.1.25",
  "dev.zio" %% "zio-config" % "4.0.1",
  "dev.zio" %% "zio-config-typesafe" % "4.0.1"
)
EOF

# Create test file
cat > src/main/scala/SkillVerificationZioConfig.scala << 'EOF'
import zio._
import zio.config._
import zio.config.typesafe.TypesafeConfigProvider

object VerifyZioConfigLoad {
  // Code from zio-config-load SKILL.md step 2
  val provider = TypesafeConfigProvider.fromResourcePath("application.conf")
}
EOF

# Compile
sbt compile

# Verify
ls -la target/scala-2.13/classes/SkillVerification*.class

# Clean up
cd /tmp
rm -rf /tmp/zio-skill-verify-config
```

**Result:** ✅ If `target/scala-2.13/classes/SkillVerificationZioConfig.class` exists, your skill examples compile correctly.

---

## Step 6 — Test Runtime (Phase 4)

For skills teaching runnable code (servers, CLI tools), confirm they actually execute correctly.

### For stateful/interactive patterns (like servers)

1. Create a `SkillRuntime<LibName>.scala` that extends `ZIOAppDefault`
2. Start the server: `sbt "zioHttpExample/runMain example.SkillRuntime<LibName>"`
3. Test it with `curl` or the library's client
4. Verify the output matches expected behavior

### For pure functions/transformations

Create a simple app that prints results:

```scala
object SkillRuntimeZioConfig extends ZIOAppDefault {
  def run = for {
    config <- ZIO.service[Config[AppConfig]]
    _ <- Console.printLine(s"Loaded config: $config")
  } yield ()
}
```

Run it: `sbt "zioHttpExample/runMain example.SkillRuntimeZioConfig"`

Expected output should print without errors.

### After runtime testing

✅ Congratulations! Your skill is production-ready.

---

## Quality Checklist

Before considering a skill "done":

- [ ] YAML frontmatter is valid (name, description, tags)
- [ ] Trigger phrases are action-oriented (verbs like "Load", "Create", "Build")
- [ ] Every code block has a comment explaining what it does
- [ ] Every code block includes all necessary imports
- [ ] Every code block compiles with `sbt` (Phase 3)
- [ ] At least one code block runs without errors (Phase 4)
- [ ] "Key types" section explains every new type introduced
- [ ] "Next steps" cross-references other skills by name
- [ ] References include GitHub source links and Scaladoc
- [ ] Code is Scala 2.13 compatible (use `given`/`derives` appropriately)
- [ ] No typos or broken markdown links

---

## Tips for Great Skills

### Make code copy-paste friendly

Every code block should be extractable, compilable, and runnable with minimal edits.

❌ Bad: `val x = someConfig // fill in your value here`

✅ Good: `val x = config.string("server.port")`

### Show both simple and advanced

Start with the minimal path (2-3 steps), then add an "Advanced Patterns" section for:
- Error handling
- Custom configuration
- Performance tuning
- Integration with other ZIO libraries

### Use real library examples

Always reference working code from the library's repo:
- Check that GitHub links are up-to-date
- Link to specific line ranges if the file is long

### Be explicit about prerequisites

If your skill depends on knowledge from another skill (e.g., "zio-schema-derive" needs Schema basics), say:

> **Prerequisite:** Understand basic ZIO types (`ZIO`, `Task`). See [zio-schema-basics](#) if new to schemas.

### Cross-link skills

End with:

> See `zio-config-validate` for enforcing config constraints.

---

## File Locations & Git Workflow

### Create your SKILL.md

```bash
# One time per skill
SKILL_DIR="skills/<lib-short>-<feature>"
mkdir -p "$SKILL_DIR"
cat > "$SKILL_DIR/SKILL.md" << 'EOF'
---
name: <lib-short>-<feature>
...
EOF
```

### Commit and push

```bash
git add skills/<lib-short>-<feature>/SKILL.md
git commit -m "feat: add <lib-short>-<feature> skill"
git push origin main
```

**Note:** Run these commands from the root of the zio-skills repository.

---

## Next Skills to Write (Ideas)

Once you've mastered this process with one library, consider:

- **zio-streams**: consume, transform, aggregate streams
- **zio-config**: load HOCON, validate config, use environment variables
- **zio-schema**: derive Schema, custom codecs, validation
- **zio-logging**: structured logging, filters, formatters
- **zio-cache**: simple caching, TTL, refresh strategies
- **zio-mock**: mock effects, verify interactions, test layers

Each follows the same 6-step process.

---

## Troubleshooting

**Q: My code doesn't compile in sbt**
A: Check that you're using the correct artifact name. Run `mvn search` for `dev.zio <lib>` to confirm the exact Maven coordinates.

**Q: The example from the repo doesn't work in my SKILL.md**
A: The library API may have changed. Compare your version against the repo's current `build.sbt`. Update to the latest compatible version.

**Q: Should I include error handling in the basic steps?**
A: Start simple (Step 1-2). Add error handling in "Advanced Patterns" only if it's a common mistake users make.

**Q: How many skills should I write per library?**
A: Start with 2-4 that cover the "first steps" a user would ask. More can be added later. Quality over quantity.

---

## References

- **ZIO documentation**: [zio.dev](https://zio.dev)
- **ZIO GitHub**: [github.com/zio](https://github.com/zio)
- **Maven Central**: [mvnrepository.com](https://mvnrepository.com)
- **Existing skills**: Browse the `skills/` directory in the zio-skills repository
