# TinyTally — Project Context

TinyTally is a tiny educational counting library for Scala 2.13. It exists to test documentation
tooling, not to be production-grade.

## Conventions

- Refer to the library as **TinyTally** (capital T, capital T).
- Source lives under `src/main/scala/tally`; runnable examples under `tinytally-examples/`.
- Tutorials are Docusaurus markdown under `docs/guides/`; reference pages under `docs/reference/`.
- Scala 2.13, so wildcard imports are `import tally._` — never `import tally.*`.

## Building the site

Run the Docusaurus build with **`npm run build`** from `website/`, not `pnpm build`. This repository sits
inside a pnpm workspace, so `pnpm run` first auto-runs `pnpm install` against the outer workspace and
fails before Docusaurus starts. `npm` has no such pre-check.
