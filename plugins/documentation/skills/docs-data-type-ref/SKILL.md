---
name: docs-data-type-ref
description: Write a reference documentation page for a specific data type in a ZIO library. Use when the user asks to document a data type, write an API reference for a type, or create a reference page for a class/trait/object.
argument-hint: "[fully-qualified-type-name or simple-type-name]"
allowed-tools: Read, Glob, Grep, Bash(sbt:*), Bash(sbt gh-query*)
---

# Write Data Type Reference Page

**REQUIRED BACKGROUND:** Import the following skill files before starting:
- `.claude/skills/docs-writing-style/SKILL.md` for prose conventions
- `.claude/skills/docs-mdoc-conventions/SKILL.md` for code block syntax throughout the document

## Target Type

$ARGUMENTS

If no type name appears above ask the user which data type they want to document before proceeding. Do not invent a type name.

## Agent Workflow

**Phase 1 — Plan (Steps 1–2, no writing yet)**

Complete Step 1 (deep source code research). Study Step 2's document structure. Before writing any documentation file, create one task per section you'll write (e.g., "Write opening definition", "Write construction methods", "Write core operations", etc.) plus tasks for Step 3–7 (verification, examples, method coverage, formatting, integration). Present the task list to the user for confirmation before proceeding.

**Phase 2 — Write (Step 2 sections)**

Execute Step 2 in order (opening definition → motivation → quick showcase → installation → construction → core operations → subtypes/comparisons/advanced → integration). Mark each task `completed` as you finish it.

**Phase 3 — Verify (Steps 3–5)**

Execute Steps 3–5 in order: verify compliance, check method coverage, then verify mdoc compilation. All code blocks must compile with zero errors.

**Phase 4 — Write Examples and Integrate (Steps 6–7)**

Write examples (Step 6), format & integrate (Step 7). Complete all integration tasks before claiming done.

## Step 1: Deep Source Code Research

Use the **`docs-research`** skill to find the source file, read tests, identify examples, find usages, read related docs, and search GitHub history. It covers steps for identifying the type, finding supporting information, and building a complete mental model.

**Additional guidance for reference pages**: Ensure you also locate the type's full public API (all public methods and companion object methods), as this will form the core of your documentation.

## Step 2: Write the Documentation

### File Location and Frontmatter

Place the file in `docs/reference/<type-name-kebab-case>.md`:

```
---
id: <kebab-case-id>
title: "<TypeName>"
---
```

The `id` must match the filename (without `.md`).

### Document Structure

Follow this structure precisely. Every section below marked **(required)** must appear. Sections marked **(if applicable)** should only appear when relevant.

#### 1. Opening Definition (required)

**NO HEADING FOR THIS SECTION.** Start with a concise, technical definition immediately after the frontmatter—do NOT add any heading (## or otherwise). This content forms the natural opening of the document.

Use inline code for the type signature. Explain the type parameters. State the core purpose in 1-3 sentences.

Pattern:

```
`TypeName[A]` is a **key concept in two or three words** that does X. The fundamental operations are `op1` and `op2`.
```

Then list key properties as bullet points if applicable:

```
`TypeName`:
- Lock-Free — safely shared across fibers with no synchronization overhead
- Atomic — no observer can witness a partially updated state
```

The definition should be concise but informative, with enough detail about type parameters and variance. For example, the `Chunk[A]` is an immutable, indexed sequence of elements of type `A`, optimized for high-performance operations.

After the definition paragraph, include the source definition of the data type in a Scala code block (using plain `` ```scala `` without mdoc, since this is for illustration):

- Show only the structural shape — the trait/class declaration with type parameters, variance annotations, and extends clauses
- Strip method bodies, private members, and extra keywords like `final`; show only the structural shape of the type

After the structural definition, follow immediately with a section header (e.g., `## Quick Showcase`) for the next section.

#### 2. Motivation / Use Case (if applicable)

Please write what the problem is and why this type is the solution in storytelling style by describing a realistic scenario.

#### 3. Quick Showcase (required)

Show core capabilities through examples. For simple types (e.g., `Writer`, `Reader`), one example suffices. For rich types (e.g., `Chunk`), combine 2–3 scenarios in a single `mdoc:reset` block (10–20 lines). Goal: readers grasp the core idea without reading further.

#### 4. Installation (if applicable)

Only include this for top-level module types (e.g., `Chunk`, `Context`, `TypeId`). Skip for internal types that come as part of a larger module.

```scala
libraryDependencies += "dev.zio" %% "<library-name>" % "@VERSION@"
```

For cross-platform (Scala.js):

```scala
libraryDependencies += "dev.zio" %%% "<library-name>" % "@VERSION@"
```

Note supported Scala versions: 2.13.x and 3.x.

#### 5. Construction / Creating Instances (required)

Document all ways to create values of the type, organized by method:

- Factory methods on the companion object (`apply`, `empty`, `from*`, `of`, `derived`)
- Smart constructors
- Builder patterns
- Conversion from other types
- Predefined instances (if any)

Each method gets its own Markdown subsection with a short explanation and a code example.

#### 6. Predefined Instances (if applicable)

List predefined instances (like `TypeId.int`, `TypeId.string`) organized by category in a table or code block.

#### 7. Core Operations (Required)

Document the primary API organized by category. Group related methods under markdown subsections:

For example:
- **Element Access** (get, apply, head, etc.)
- **Transformations** (map, flatMap, filter, etc.)
- **Combining** (++, combine, merge, etc.)
- **Querying** (exists, forall, find, contains, etc.)
- **Conversion** (toList, toArray, toString, etc.)

For each group:
- List methods with brief descriptions
- Show a code example demonstrating 2-4 methods together
- Note performance characteristics inline when relevant (e.g., "O(1)", "O(n)")

For each method:
a. **Use a Markdown subheader** with the method name using the pattern: `` `MethodName` — Brief Description ``
   - Example: `` `Resource.apply` — Wrap a Value ``
   - Example: `` `Resource#map` — Transform the Value ``
b. **Explain what it does** in plain language
c. **Show the method signature** in a plain `scala` code block using the simplest trait interface format — just the method name, parameters, and return type, without extra keywords like `override`, `final`, `sealed`. For example:

```scala
trait Chunk[+A] {
  def map[B](f: A => B): Chunk[B]
}
```

If the method is in the companion object, show it as a function in the companion object's simplest form:

```scala
object Chunk {
  def apply[A](as: A*): Chunk[A]
}
```
d. **Show a usage example** using the Setup + Evaluated Output pattern:
   - Combine setup and output in a **single code block** using `mdoc:silent:reset` (or just `mdoc:reset` if resetting state)
   - Setup code goes first (define types/values needed), followed by the method call and output
   - This demonstrates both how to call the method AND what it returns

   Example pattern:
   ```
   ​```scala mdoc:reset
   case class Person(name: String)
   val p = Person("Alice")

   p.name  // Shows: val res0: String = Alice
   ```

   **Style rule:** Between any two code blocks, include an **explanatory paragraph** that introduces or describes what the following code demonstrates. Do NOT leave empty lines between code blocks.

   ✅ Correct:
   ```
   ​```scala mdoc
   val x = 1
   ```
   Now let's use x to compute a result:

   ​```scala mdoc
   val y = x + 1
   ```
   ```

   ❌ Wrong:
   ```
   ​```scala mdoc
   val x = 1
   ```

   ​```scala mdoc
   val y = x + 1
   ```
   ```

e. **Note important caveats** using [Docusaurus admonitions](#docusaurus-admonitions)

#### 8. Subtypes / Variants (if applicable)

Document important subtypes (e.g., `NonEmptyChunk` for `Chunk`) with: when to use, how to create, operations that differ, and conversion examples.

#### 9. Comparison Sections (when applicable)

Compare with analogous concepts from Java, Scala stdlib, or theoretical CS when it adds clarity. Examples:
- "Ref vs AtomicReference in Java"
- "Ref vs State Monad"
- "Promise vs Scala's Promise"
- "Chunk vs List vs Array"
- "TypeId vs Scala's TypeTag vs Java's Class"
- "Lazy vs lazy val vs def"

Use padded table columns for readability (see **`docs-writing-style`** for table formatting rules).

#### 10. Advanced Usage / Building Blocks (when applicable)

Show how the type composes with other types or how it can be used to build higher-level abstractions.

#### 11. Integration (if applicable)

Show how this type integrates with other data types in the same library and module. For example:
- How `TypeId` is used in `Schema`
- How `Chunk` is used in `Reflect`
- How `DynamicValue` connects to `Schema` and formats

Add cross-references to related docs (e.g., `[Schema](./schema.md)`, `[Reflect](./reflect.md)`) after explaining the integration of each related type.

#### 12. Running the Examples (required when standalone examples exist)

**How to create the section:**
1. Use the **`docs-examples`** skill to create example project or example files.
2. Embed each example using `SourceFile.print` with: description paragraph → source link → run command.
3. Place the section at the very end of the page (after Integration).

**When invoking `docs-examples`:** Pass the examples module name (e.g., `schema-examples`), repo name, package name, and specify this is a **data type reference** (for SourceFile-embedding template).

### Writing Rules

- Document every public method on the type and its companion object.
- Use ASCII art for type hierarchies and data structures.
- Link to related docs using relative paths: `[TypeName](./type-name.md)`.

## Step 3: Verify Documentation Compliance

Run `/docs-verify-compliance` skill.

## Step 4: Verify Method Coverage

Use **`docs-data-type-list-members`** to extract members, then **`docs-report-method-coverage`** to verify coverage:

```bash
/docs-data-type-list-members <TypeName> | /docs-report-method-coverage <TypeName> docs/reference/<type-name>.md
```

Or save members to file first, then report:
```bash
/docs-report-method-coverage <TypeName> docs/reference/<type-name>.md members.txt
```

Coverage report shows completeness by category: Companion Object, Public API, Inherited Methods.

## Step 5: Verify Documentation

Run mdoc to verify all code blocks compile correctly:

```bash
# Single file:
sbt "docs/mdoc --in <file_path>.md"

# Multiple files
sbt "docs/mdoc --in <file1_path>.md --in <file2_path>.md"

# Or use a directory to cover all files in it:
sbt "docs/mdoc --in <directory_path>/"
```

**Success criterion:** zero `[error]` lines in mdoc output.

---

## Step 6: Write Examples

Use the **`docs-examples`** skill to create and document runnable examples. Invoke it after completing Step 5 (mdoc verification), so you know which use cases need illustration.

Pass as context: the examples module name, the package name derived from the type name (lowercase, hyphens removed), and that this is a **data type reference** page. The skill covers directory setup, file templates, compilation, formatting, and the "Running the Examples" section.

**Data-type-ref specific:** When printing expression results in examples, prefer `util.ShowExpr.show(expr)` to display both the expression and its evaluated value — this is more informative than `println` for reference documentation.

---

## Step 6: Format and Finalize

Format all Scala files:

```bash
sbt scalafmtAll
```

Verify lint checks pass:

```bash
sbt check
```

---

## Step 7: Integrate

Use the **`docs-integrate`** skill for integration checklist (sidebars.js, index.md, cross-references).
