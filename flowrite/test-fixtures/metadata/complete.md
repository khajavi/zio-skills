---
id: complete
title: "Iso"
description: "Convert losslessly between two representations of the same value, in either direction."
keywords:
  - "Functional Optics"
  - "Lossless Conversion"
  - "Iso Composition"
---

An `Iso` is an optic between two types that hold exactly the same information, so converting in
either direction loses nothing.

## Both directions

`get` converts forward and `reverseGet` converts back. Applying one and then the other returns the
value you started with, which is what makes the pair an isomorphism rather than a mere conversion.

## Composing

An `Iso` composes with any other optic, and composing it with its own reverse gives the identity.
