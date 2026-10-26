---
name: docs-mdoc-conventions
description: Shared reference for mdoc code block modifiers and Docusaurus admonitions used across ZIO library documentation skills. Include when writing any documentation that contains Scala code blocks.
allowed_tools: Read, Glob, Grep
color: silver
---

## Agent Workflow

**Phase 1 — Planning only, no edits yet**
Scan the document and identify every Scala code block missing an mdoc modifier
(skip pseudocode / type-signature-only blocks). For each block found:

1. Create a parent task: "Fix mdoc modifier – <section>:<line>"
2. Under it, create two child tasks:
  - "1. Choose and apply modifier"
  - "2. Run `sbt \"docs/mdoc --in <file>.md --out website/<file>.md\"` and confirm zero errors"

Do not touch any source file until the full task tree is created and you have
listed it for confirmation.

**Phase 2 — Execution, one leaf task at a time**
Work through the tree top-to-bottom. For each parent task:
- Mark parent `in_progress`
- Mark child 1 `in_progress` → apply modifier → mark child 1 `completed`
- Mark child 2 `in_progress` → run `sbt mdoc` → confirm exit 0 → mark child 2 `completed`
- Mark parent `completed`
  Only then move to the next parent task.

**Phase 3 — Mechanical validation**
After all tasks are `completed`, run:
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh <file.md>
Verify exit code is 0. If not, re-open the relevant tasks and fix.

## Modifiers & Rules

Each modifier has a specific role. Choose based on whether you need scope sharing and whether output should render:

- **`mdoc:compile-only`** — Renders source code only, isolated scope (no definitions carry over).
  This is the **default** for self-contained examples where you want to show the structure but not
  the evaluated output. Subsequent blocks cannot reference definitions from a `compile-only` block.
  Isolation is one-way: a `compile-only` block is still compiled *inside* the scope of the page's
  earlier evaluated blocks (since the last `:reset`), so an earlier wildcard import can still shadow
  names in it. Seen in zio-blocks: an earlier `import zio.blocks.sql._` (whose package has a `zio`
  subpackage) broke the `import zio.blocks.schema.Schema` line of every later self-contained
  `compile-only` block; the fix was an `mdoc:invisible` block with `import _root_.zio` before them.

- **`mdoc:silent`** — Renders the source but not the evaluated output, scope shared with subsequent blocks.
  Use to define types, values, or imports that later blocks will reference. Scope persists until
  you use `silent:reset`. You **cannot** redefine the same name in a later block — use
  `mdoc:silent:nest` for that.

- **`mdoc:silent:nest`** — Renders the source but not the output, scope shared, code wrapped in anonymous `object`.
  Like `silent`, but allows you to **shadow/redefine names** from earlier blocks (e.g., redefining
  `Person` with different fields in a later section). Use when `silent` would fail due to name collision.

- **`mdoc:silent:reset`** — Renders the source but not the output, clears all prior scope.
  Wipes the entire accumulated scope and starts fresh. Use when switching to a completely different
  context (new domain, new imports) mid-document and `silent:nest` wouldn't suffice.

- **`mdoc`** (no qualifier) — Renders source + evaluated output, scope shared with subsequent blocks.
  Shows both the code and its REPL-style result (as if you'd written `// Right(42L)` by hand, but
  evaluated). Can build on definitions from prior `silent`/`silent:nest` blocks, or run standalone
  for self-contained examples that just need to show their output.

- **`mdoc:invisible`** — Invisible code block, scope shared with subsequent blocks.
  Signals "hidden imports only" — rare in practice. Prefer including imports directly in a
  `mdoc:silent` setup block (so they're visible in scope) or inside a `compile-only` block
  (for self-contained examples). Use `invisible` only when you need imports shared across blocks
  but must **not** appear anywhere in the rendered output.

- **`mdoc:embed:<path>`** — Custom modifier: replaces the block (leave its body empty) with the file
  at `<path>` (repo-root relative) rendered as a titled code fence. Append `:showLineNumbers` for line
  numbers. Use for a tutorial's "Putting It Together" final block, pointing at the companion example
  file that is the single source of truth for that complete example — never paste the same code inline
  when a companion file already carries it. Requires the docs subproject to depend on
  `"dev.zio" %% "zio-sbt-source"` — add it if missing.

- **A plain-fenced JMH benchmark still gets verified.** JMH can't run in mdoc, but compile and smoke-run
  the snippet verbatim with `scala-cli --power run --jmh <file> -- -wi 1 -i 1 -f 1 -w 1s -r 1s`. JMH's
  bytecode generator rejects classes in the default package ("Benchmark class should have package other
  than default"), so the snippet needs a `package` line. Prefer `val` state fields over `var x = _`
  (deprecated syntax on Scala 3.4+). Seen in zio-blocks `docs/guides/tune-json-throughput.md`.

- **Read the rendered output against the prose, line by line.** A block can compile, run and still
  contradict its own sentence. Seen in zio-blocks H-50: a failed `ByteBuffer` decode before `flip()`
  advanced `position` by one byte, so the "after flip" decode printed `Left(expected end of input)`
  under prose promising the book. Both mdoc and the companion example printed it; nobody flagged it.

- **No mdoc** (plain `` ```scala ``) — Renders source code only, not compiled.
  Use for pseudocode, ASCII diagrams, type signatures for illustration, or non-Scala syntax (e.g., sbt configuration).

- **Code that needs a live service still compiles in mdoc.** A snippet that opens a database pool,
  a socket or a server would fail when mdoc *evaluates* it, but that's no reason for a plain fence:
  put it in a `mdoc:silent` block as a `def` that no later block calls (`def openPool(): HikariDataSource
  = new HikariDataSource(config())`). mdoc compiles the body and shares the name with later blocks,
  and nothing runs. Add the third-party library to the docs project's `libraryDependencies` (ask
  first) instead of downgrading the snippet; keep real output for the parts that need no service.
  Mind the JDK the docs build runs on: an API newer than it (e.g. virtual threads on a JDK 17 docs
  build) can't compile, so take it as a parameter (`executor: ExecutorService`) and show only the
  JDK-specific line in a plain fence.

- **Public API only.** An mdoc block compiles in the default package, exactly like user code —
  reference only PUBLIC symbols. A `private`/`private[pkg]`/`protected` type or member won't compile in
  a snippet, so never demonstrate a closed extension point: ✅ implement the public
  `LogRecordProcessor` ❌ implement `LogFormatter` whose required parameter type is
  `private[telemetry]`. Verify visibility against the real source before drafting; if the only path
  needs a package-private symbol, pick a public alternative or drop the example.

- -**Never hardcode expression output in comments**: Let mdoc render output automatically, don't add comments like `// None` or `// "hello"`. Use bare `mdoc` to show all vals; only use `mdoc:silent` when output is verbose boilerplate.
- **Values that change every run (generated keys, random ids, timestamps) go in `mdoc:silent`**: a bare `mdoc` block prints every `val` binding (`// keys: KeyPair = ...`), so key bytes or a fresh token would land in the page and change on each build. Define them in `mdoc:silent`, then print only the stable results (verification outcomes, formats) with `println` in a following `mdoc` block. Pin clocks with an explicit "now" parameter where the API offers one.

**Bad vs. Good:**
- ❌ `val x = 42 // 42`  
  ✅ `val x = 42` (mdoc renders the output)

- **mdoc's value printer ignores a custom `toString`.** mdoc renders a bare expression with pprint,
  which walks case-class/product structure: a `Schema` prints as `Schema(Record(fields = Vector(Term(...`
  instead of its readable `toString`, and a `String` holding JSON prints with escaped quotes
  (`"{\"title\":...}"`). When the reader should see the type's own rendering (pretty-printers, JSON
  text, error messages, multi-line output), wrap it in `println(...)` — mdoc shows stdout as plain
  `// ...` lines. Keep bare expressions for values whose structural form is the point (e.g. `Right(Book(...))`).
  The same applies to a `val` holding an opaque object (a derived codec, a deriver): an `mdoc` block
  prints `codec: JsonCodec[Book] = ...JsonCodecDeriver$$anon$4@4b7f5201`. Define such values in an
  `mdoc:silent` block and use them in the next `mdoc` block.
- **mdoc captures Scala's `Console.out`, not `System.out` or `System.err`.** `println` output appears
  in the page, but a library that writes with `System.out.println` or to `System.err` (a logger's default
  console, a `StdoutWriter`/`StderrWriter`) prints to the sbt terminal and the page shows nothing. Check
  the rendered page, not the sbt log. To render such output, add an `mdoc:invisible` block at the top
  that stashes the real streams (e.g. in `System.getProperties`, which survives `:reset`) and replaces
  both with a `PrintStream` whose `OutputStream` forwards each line to `Console.out` (resolved at write
  time, so it lands in the current block). The same stream can mask per-run values (timestamps, ids:
  number each distinct id so equal ids stay visibly equal). Restore both streams in an `mdoc:invisible`
  block at the end, or later pages in the same mdoc JVM are captured too. Worked example: zio-blocks
  `docs/guides/instrument-a-program-with-logs-traces-and-metrics.md`.

- **Literal `\uXXXX` escapes in prose get decoded by the Write/Edit tools.** Tool arguments are JSON, so a
  page sentence meant to show `\u003cscript\u003e` (e.g. JSON that escapes `<`) lands on disk as `<script>`.
  Write such text with a byte-safe edit (e.g. Python building the backslash from `chr(92)`), then confirm with
  `grep -n 'u003c' <file>`. Subagent reports and reviewer findings are decoded the same way in transit, so check the
  raw bytes before accepting or rejecting a finding about such text.

- **`mdoc:fail` on Scala 3 ignores earlier `:reset`s.** The fail block is compiled together with the
  page's earlier code, so a page that redefines the same names across `:reset` sections (e.g. a
  how-to guide with one `Book` per recipe) renders bogus `Book is already defined as class Book`
  errors instead of the intended one — `mdoc:reset:fail` doesn't help. Use `mdoc:fail` only on pages
  whose names are unique across all sections; otherwise describe the compile error in prose (quoting
  the message from source or a test that pins it). Always read the rendered `// error:` lines.

- **`mdoc:fail` / `mdoc:warn` also inline earlier `compile-only` blocks.** Their instrumented program
  is every earlier evaluated block of the page *plus* the earlier `compile-only` blocks, pasted in
  unwrapped. A broken `class Book` followed by a `compile-only` fix that defines `case class Book` in
  the same section compiles fine on its own, but every later `mdoc:warn` then fails with only
  `Expected compile warnings but program failed to compile` (no reason given), and later `mdoc:fail`
  blocks may fail for the clash instead of their intended error. Seen on Scala 3.9 (zio-blocks
  fix-scope-and-wire-compile-errors guide, where redefinitions across `:reset` sections *did* work).
  Fix: start any fix block that redefines a name with `mdoc:silent:reset` instead of `compile-only`.
  To see the hidden error, rerun with `docs/mdoc --verbose ...` and read the `FailSection("...")`
  string that contains the failing block.

## Choosing the Right Modifier

Use this decision tree to pick the right modifier:

```
Is this real executable Scala code?
│
├─ NO → Use plain ```scala (pseudocode, ASCII art, type signatures)
│
└─ YES → Do later blocks need these definitions?
   │
   ├─ NO → Do you want to show the output/result?
   │  │
   │  ├─ NO → Use mdoc:compile-only (source only, isolated)
   │  │
   │  └─ YES → Use mdoc (source + output, isolated)
   │
   └─ YES → Is this a later block showing a result?
      │
      ├─ YES → Use mdoc (source + output)
      │
      └─ NO → Are you redefining a name from an earlier block?
         │
         ├─ YES → Use mdoc:silent:nest (shadow existing names)
         │
         └─ NO → Use mdoc:silent (regular setup)
```

**After any mdoc:silent block**, if you later need a completely different context (new domain, new imports), use `mdoc:silent:reset` to clear all state.

## Common Patterns

### Pattern 1: Silent Setup + Output Rendering (Query DSL SQL Guide)

```scala mdoc:silent
import zio.blocks.schema._

case class Product(
  name: String,
  price: Double,
  category: String,
  inStock: Boolean,
  rating: Int
)

object Product extends CompanionOptics[Product] {
  implicit val schema: Schema[Product] = Schema.derived
  val price: Lens[Product, Double] = optic(_.price)
}

def columnName(optic: zio.blocks.schema.Optic[?, ?]): String = {
  val nodes = optic.toDynamic.nodes
  nodes.collect { case f: DynamicOptic.Node.Field => f.name }.mkString("_")
}
```

Now with `columnName` in scope, we can call it and see the result:

```scala mdoc
columnName(Product.price)
columnName(Product.name)
```

This pair shows the two-block pattern: `silent` for setup (which doesn't render), then `mdoc` for expressions where the output is meaningful to show.

### Pattern 2: Redefining with Nesting

When you need to redefine a name (e.g., `Person`), use `nest` modifier:

```
Block A: mdoc
  ├─ case class Person(...)    ← in scope
  └─ val alice = ...           ← in scope

Block B: mdoc
  ├─ Can reference alice  ✓
  └─ Can reference Person ✓

Block C: mdoc:nest
  ├─ All prior scope accessible ✓
  └─ Can redefine Person ✓

Block D: mdoc
  ├─ Can reference new Person  ✓
  └─ Cannot reference old Person ✗
```

### Pattern 3: Self-Contained

```scala mdoc:compile-only
case class User(name: String, age: Int)
val user = User("Alice", 30)
```

Each `compile-only` block stands alone. The next example in the document doesn't have access to `person`.

### Pattern 4: Setup + Show Output

Only use this pattern when the first block defines multiple larger setup code (e.g., multiple case classes, imports) that later blocks will reference and the later block should be evaluated to show output.

```scala mdoc:silent
def add(a: Int, b: Int): Int = a + b
```

Now call it and show the result:

```scala mdoc
add(2, 3)
```

If the setup is just a single line or two, it's often cleaner to combine it with the output block:

```scala mdoc
def add(a: Int, b: Int): Int = a + b

add(2, 3)
```

### Pattern 5: Multi-Step Guide
1. **Setup block** → `mdoc:silent` (case classes, imports)
2. **Example 1** → `mdoc` (show output)
3. **Building on Example 1** → `mdoc` (reuse prior definitions)
4. **New Topic** → `mdoc:silent:reset` + `mdoc:silent` (fresh context)
5. **Final Copy-Paste** → `mdoc:compile-only` (standalone)

### Pattern 6: Multi-Example Documentation Suite

When a document contains many independent, self-contained examples (e.g., each type in a library having 4–6 usage examples), **every** example's first code block must use `mdoc:silent:reset` to prevent variable name collisions across examples.

Without reset, variables like `val file`, `val config`, or `val user` defined in Example 1 conflict with identically-named vars in Example 2—producing "Conflicting definitions" errors even when the examples are conceptually separate.

```scala mdoc:silent:reset
import zio.blocks.codegen.ir._
import zio.blocks.codegen.emit._

val user = CaseClass("User", List(Field("id", TypeRef.Long)))
val file = ScalaFile(
  packageDecl = PackageDecl("com.example"),
  types = List(user)
)
```

```scala mdoc
ScalaEmitter.emit(file, EmitterConfig())
```

The next example resets again:

```scala mdoc:silent:reset
val order = CaseClass("Order", List(Field("id", TypeRef.Long)))
val file = ScalaFile(
  packageDecl = PackageDecl("com.example"),
  types = List(order)
)
```

```scala mdoc
ScalaEmitter.emit(file, EmitterConfig())
```

**Rule:** In multi-example documents, `:reset` is not "sparingly used"—it is used **once per independent example**. The "use sparingly" advice in the Tips section applies to *within* a single example (where `:nest` is usually better).

## When to Use `:reset`

- Switching to a **completely different domain** (Product → JSON → User)
- Starting a **new tutorial section** with independent examples
- **Isolating independent examples in a multi-example document** — when each `###` section is a fresh, self-contained example that reuses common variable names like `file`, `config`, or `user`
- Avoid if: just defining a new helper function (doesn't need reset)

## Tips

- **Never manually write `// result` comments** — use `mdoc` to show real output
- **Test locally with `sbt docs`** before committing mdoc blocks
- **Group related setup blocks** — define all prerequisites in one `silent` block if possible
- **Use `:reset` at the right scope** — once per independent example in multi-example documents; prefer `:nest` for minor redefinitions *within* a single example
- **Objects are nested in `repl.MdocSession.MdocApp`** — `getClass.getName` of an `object Foo` defined in an mdoc block is `repl.MdocSession$MdocApp$Foo$`. APIs that derive a name from the class (e.g. zio-blocks `StaticFlag`/`DynamicFlag`, whose name is the fully-qualified object name) show that prefix in output; say so once on the page, and point to the companion examples for real package names. Prefer reading the name back (`Foo.name`) after first touch over hard-coding it
- **Global singletons leak across blocks and reruns** — mdoc evaluates the page in one JVM, and a rerun in the same sbt server may reuse library classes. If the library keeps a global registry (zio-blocks `FlagSource.Registry`, `Flag.registry`), clear it in an `mdoc:invisible` block at the top of the page, or a rerun can throw duplicate-registration errors

## Mechanical Validation

Before submitting changes, run the mdoc-conventions checker against the file. It flags any plain ```` ```scala ```` block that should carry an mdoc modifier:

```
bash ${CLAUDE_PLUGIN_ROOT}/skills/docs-mdoc-conventions/check-mdoc-conventions.sh <file.md>
```

Run with `--help` for full usage. **Exit codes:**

| Code | Meaning                                                          |
|------|------------------------------------------------------------------|
| `0`  | No violations — every executable Scala block has an mdoc modifier. |
| `1`  | One or more code blocks are missing mdoc modifiers.              |
| `2`  | Invocation error (missing/extra arguments, file not found).      |

## Docs Classpath

mdoc compiles against the docs project's `.dependsOn(...)`. If the documented module is missing there,
add it to `build.sbt` (match sibling style, e.g. `<module>.jvm`) and reload — never downgrade real code
to plain ```` ```scala ```` over a missing dependency, and never leave a runnable example uncompiled to
work around a build gap.

**A build's gap is fixed in the build, never in the page.** `key not found: VERSION` means the docs
project defines no `mdocVariables`, so add `mdocVariables += "VERSION" -> version.value` there and
re-run: ✅ `mdocVariables += "VERSION" -> version.value"` in `build.sbt` ❌ writing `% "0.1.0"` into the
page (it reads as fixed, and it breaks writing-style rule 25's `@VERSION@` placeholder).

## Verifying the Full Compile

The mechanical checker above only catches a missing modifier — it cannot catch a real compile error.
Always follow it with an actual mdoc compile, scoped to the file you touched, never the whole docs set
(unscoped `sbt docs/mdoc` recompiles every doc — minutes of sbt for a one-file change):

```bash
sbt "docs/mdoc --in <file> --out website/<file>"
```

`mdoc` is an sbt task, not a shell binary: quote the whole `docs/mdoc …` as one argument (never bare
`mdoc`, never unquoted). One `--in`/`--out` pair per file; `--out` is the same path prefixed with
`website/`, e.g. `docs/reference/x.md` → `website/docs/reference/x.md`. If the failure output only
shows a stack trace with "stack trace is suppressed; run 'last <scope>'", run that `sbt "last <scope>"`
command to get the real error.

## Troubleshooting

If mdoc produces more than 3 compilation errors, the blocks are likely not properly isolated. Check for missing `:reset` or `:nest` modifiers, or name collisions between blocks. If the issue persists, strip all mdoc modifiers from the reported lines, confirm the errors are gone, then re-apply the correct modifiers one by one using the decision tree — running `sbt "docs/mdoc --in <path> --out website/<path>"` after each change to verify before continuing.

Common mistakes when writing mdoc blocks? See **`references/troubleshooting.md`** for solutions to.

mdoc wraps every top-level definition in a class, so `@tailrec` on a top-level `def` fails with "TailRec optimisation not applicable, method ... is neither private nor final". Drop the annotation in the page (keep it in the companion example, where the `def` lives in an `object`).

---

## Tabbed Scala 2 / Scala 3 Examples

When a section shows syntax that differs between Scala 2 and Scala 3, use Docusaurus tabs
instead of sequential prose blocks. This lets readers pick their version once and have all
tab groups on the page sync together.

### Required MDX imports

Add these two lines at the top of any `.md` file that uses tabs (right after the closing
`---` of the frontmatter, before any prose):

```mdx
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
```

### Tab structure

````mdx
<Tabs groupId="scala-version" defaultValue="scala2">
  <TabItem value="scala2" label="Scala 2">

```scala mdoc:compile-only
// Scala 2 syntax here
```

  </TabItem>
  <TabItem value="scala3" label="Scala 3">

```scala mdoc:compile-only
// Scala 3 syntax here
```

  </TabItem>
</Tabs>
````

### Rules

- Always use `groupId="scala-version"` — this syncs all tab groups on the page when the
  reader picks a version.
- Always use `defaultValue="scala2"` — Scala 2 is shown first by default.
- Blank lines inside `<TabItem>` are required for mdoc to process fenced code blocks
  correctly.
- `mdoc:compile-only` is the correct modifier for code inside tabs (same as everywhere
  else).
- mdoc passes JSX components through unchanged — only fenced `scala mdoc:*` blocks are
  rewritten.
- Do **not** use tabs for examples that are identical in both versions — only use them
  when the syntax genuinely differs.

---

## Docusaurus Admonitions

Use Docusaurus admonition syntax for callouts: (Titles are optional)

```
:::note[Title of the note]
Additional context or clarification.
:::

:::tip[Title of the tip]
Helpful shortcut or best practice.
:::

:::warning[Title of the warning]
Common mistake or gotcha to avoid.
:::

:::info[Title of the info]
Background information that is useful but not essential.
:::

:::danger[Title of the danger]
Serious risk of data loss, incorrect behavior, or security issue.
:::
```

Use admonitions **sparingly** — at most 3–4 in a typical document. They should highlight genuinely
important information, not decorate every section.
