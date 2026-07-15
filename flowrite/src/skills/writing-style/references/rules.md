
1. **Person pronouns**: Use "we" when guiding the reader or walking through examples ("we can create...", "we need to..."). Use "you" when addressing the reader's choices ("if you need...", "you might want to...").
2. **Tense**: Present tense only ("returns", "creates", "modifies"). Exception: promises about the reader's future are fine ("By the end of this tutorial, you will...").
3. **No padding/filler**: No filler phrases like "as we can see" or "it's worth noting that". Just state the fact. Exception: tutorial warmth ("Welcome!", "Let's", "That's it!", "notice that") is required tone, not filler.
4. **Bullet capitalization**: When a bullet point is a full sentence, start it with a capital letter.
5. **No manual line breaks in prose**: Do not hard-wrap paragraph text at a fixed column. Write each paragraph as one continuous line.
6. **ASCII art usage**: Use it for diagrams showing data flow, type relationships, or architecture. Readers find these very helpful for understanding how pieces fit together.
7. **Link to related docs**: Use relative paths with the full filename including `.md` extension. Never use a bare directory name: ✅ `[Endpoint](./reference/endpoint/index.md)`, ❌ `[Endpoint](./reference/endpoint)`.
8. **Qualify method/constructor names at their first mention in the article**: the first prose reference to a method names its receiver — ✅ "Call `Chunk#map` to transform elements"; later mentions may use the bare name ("then `map` again over the result"). Dot-prefixed references (`` `.method` ``) are always a violation — they imply a receiver without naming it.
9. **Type name alone rule**: When referring to a type (not a method), use only its name in backticks with no qualifier: "`As` derives automatically", "`List` is a sequence type", "convert to `Option`".
10. **No duplicate markdown heading**: Do not create a markdown heading (`#`) that duplicates the frontmatter title. Start directly with `## Overview` or the first real section.
11. **Heading hierarchy**: Use `##` for major sections, `###` for subsections, `####` for subsubsections.
12. **No bare subheaders**: Always write an intro sentence between a header and its first nested subheader — both `##` → `###` and `###` → `####`. Never stack two headings with no prose between.
13. **No lone subheaders**: Never create a subsection with only one child — except a Core-Operations category may keep one method when no related category fits.
14. **When to use `####`**: Use `####` to organize multiple related topics under a single `###`.
15. **Every code block must be preceded by a prose sentence ending with `:`**. Never follow a heading directly with a code block. Between consecutive code blocks, add bridging prose that explains what the next block demonstrates.
16. **Always include imports**: Every code block starts with the necessary import statements. Exception for mdoc pages: mdoc blocks share one scope, so imports in the first block of the page satisfy this rule for all later blocks.
17. **One concept per code block**: Each code block demonstrates one cohesive idea.
18. **Prefer `val` over `var`**: Use immutable patterns wherever possible.
19. **Show method signatures within their containing type**, not as bare signatures: ❌ `def map[B](f: A => B): ZIO[R, E, B] = ???` ✅ `trait ZIO[-R, +E, +A] { def map[B](f: A => B): ZIO[R, E, B] = ??? }`.
20. **Write contextualized descriptions for code blocks**: Introduce each block with a sentence that relates it to what it demonstrates and ends with a colon. Avoid generic phrases like "here's an example".
21. **Bullet list formatting**: Use bullets only for independent, enumerable items — never to explain a single definition, and never a list of one or two items; write prose instead. When items form a connected narrative, write prose. Never place blank lines between bullet items.
22. **Pad column alignment**: Align table columns with spaces for readability.
23. **Default to Scala 2.13.x syntax**: Use `import x._` for wildcard imports, never `import x.*`.
24. **Use tabs for version-specific syntax**: Use tabbed code blocks to show Scala 2 vs 3 differences (e.g. `using` vs `implicit`). Scala 2 is the default tab.
25. **Use the `@VERSION@` placeholder for versions**: ❌ `libraryDependencies += "dev.zio" %% "zio-blocks" % "1.0.0"` ✅ `libraryDependencies += "dev.zio" %% "zio-blocks" % "@VERSION@"`.
