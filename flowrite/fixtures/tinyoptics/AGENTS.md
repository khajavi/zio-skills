# TinyOptics — Project Context

TinyOptics is a tiny educational optics library (lenses, prisms) for Scala 2.13.
It exists to teach how optics compose, not to be production-grade.

## Conventions

- Refer to the library as **TinyOptics** (capital T, capital O).
- Source lives under `src/main/scala`; runnable examples under `examples/`.
- Tutorials are Docusaurus markdown under `docs/guides/`.

## Building the site

Run the Docusaurus build with **`npm run build`** from `website/`, not `pnpm build`. This repository sits
inside a pnpm workspace, so `pnpm run` first auto-runs `pnpm install` against the outer workspace and
fails before Docusaurus starts. `npm` has no such pre-check.
