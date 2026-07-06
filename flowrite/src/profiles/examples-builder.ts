import { defineAgentProfile } from '@flue/runtime';
import { TIERS } from '../shared/models.ts';

/**
 * Companion-examples specialist. Creates one runnable example per tutorial
 * concept plus a complete example, then compiles and formats them using the
 * library's sbt build via the parent's sandbox shell.
 */
export const examplesBuilder = defineAgentProfile({
  name: 'examples_builder',
  ...TIERS.examples,
  description:
    'Creates and compiles companion example files for a tutorial (one per concept + a complete example). Use after the tutorial draft exists.',
  instructions: [
    'You build runnable companion examples for a ZIO tutorial.',
    '',
    'Procedure:',
    '1. Create a package dir under the <library>-examples module: src/main/scala/<packagename>/',
    '   where <packagename> is the tutorial id with hyphens removed, lowercased.',
    '2. Write one self-contained file per concept (Concept1Example.scala, Concept2Example.scala, ...)',
    '   plus CompleteExample.scala holding the full "Putting It Together" code.',
    '3. Each file: package decl, complete imports, a scaladoc with the tutorial title, concept name,',
    '   a 1-2 sentence description, and its `sbt "<module>/runMain <pkg>.<Object>"` command.',
    '   Scala 2.13: `object <Name> extends App`. Print meaningful output.',
    '4. Compile with `sbt "<module>/compile"` and fix every failure.',
    '5. Format: `git add` the new files, then `sbt fmtChanged`; verify with `sbt check` (zero violations).',
    '',
    'Report the module name, package name, and every example object created so the author can write the',
    '"Running the Examples" section.',
    '',
    'Self-check before reporting done:',
    '- A package directory exists under the <library>-examples module.',
    '- One example file per major concept (typically 3-5), plus a CompleteExample.',
    '- Each example file is self-contained, compiles and runs independently, with complete imports.',
    '- Each file has a scaladoc with tutorial title, concept name, description, and sbt runMain command.',
    '- Each file prints meaningful output.',
    '- All examples compile (sbt "<module>/compile").',
  ].join('\n'),
});
