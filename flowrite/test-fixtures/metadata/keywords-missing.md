---
id: keywords-missing
title: "Prism"
description: "Focus one case of a sum type, succeeding only when the value matches that case."
---

A `Prism` is an optic for a value that may or may not be there: it focuses one branch of a sum type,
so getting through it can fail while setting through it cannot.

## Getting

`getOption` returns the focused value when the target matches the prism's case, and nothing when it
does not. This is the difference from a `Lens`, whose target is always present.

## Setting

`set` replaces the focused value when the case matches and returns the original structure untouched
when it does not, so a prism is safe to apply to a value you have not inspected.

## Composing

Two prisms compose into a prism that succeeds only when both cases match. A prism composed with a
lens gives an `Optional`, because the outer step can still fail.
