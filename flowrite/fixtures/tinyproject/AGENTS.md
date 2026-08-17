# TinyProject — Project Context

TinyProject is a tiny educational Scala 2.13 library with two independent modules. It exists to test
documentation tooling, not to be production-grade.

- **`optics`** — lenses, prisms and their friends: composable, immutable data access and update.
- **`tally`** — counting: an append-only ledger and a bounded window over recent readings.

The two modules share nothing at runtime. Documenting one never requires reading the other, so a page
that mentions the wrong module's types is a mistake, not a shortcut.

## Conventions

- Refer to the library as **TinyProject**, and to a module by its own name — **TinyOptics** for
  `optics`, **TinyTally** for `tally`.
- Module source lives under `<module>/src/main/scala/<module>/`, e.g. `tally/src/main/scala/tally/`.
- Runnable examples live under `tinyproject-examples/<module>/`.
- Tutorials are Docusaurus markdown under `docs/guides/`; reference pages under `docs/reference/`.
  One `docs/` tree covers both modules, so put a module's pages under `docs/reference/<module>/`.
- Scala 2.13, so wildcard imports are `import tally._` — never `import tally.*`.

## Building the site

Run the Docusaurus build with **`npm run build`** from `website/`, not `pnpm build`. This repository sits
inside a pnpm workspace, so `pnpm run` first auto-runs `pnpm install` against the outer workspace and
fails before Docusaurus starts. `npm` has no such pre-check.
