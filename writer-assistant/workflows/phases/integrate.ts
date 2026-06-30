export async function runIntegratePhase(
  session: any,
  options: {
    projectRoot: string;
    outputFileName: string;
    topic: string;
    docType: 'tutorial' | 'how-to-guide';
  }
): Promise<void> {
  const { projectRoot, outputFileName, topic, docType } = options;

  const sidebarNote =
    docType === 'tutorial'
      ? `Add entry for ${outputFileName} under the "Guides" category (not "Reference")`
      : `Add entry for ${outputFileName} under the "Guides" category (not "Reference" or "Tutorials") — create the "Guides" category if it doesn't exist`;

  const crossRefNote =
    docType === 'tutorial'
      ? `Check if other reference pages or how-to guides should link to this tutorial
   - Add reciprocal cross-references where appropriate
   - Tutorials should link from "Where to Go Next" to related how-to guides`
      : `Check if reference pages for types used in this guide should link back to the guide
   - Add reciprocal cross-references where appropriate (e.g., if the guide covers Schema, add a "See also" link from docs/reference/schema.md)`;

  const integratePrompt = `**Phase 4: Format and Integrate**

Finalize the ${docType} for ${topic} and integrate it into the docs structure.

**Integration steps:**

1. **Format Scala code**
   - Run: sbt scalafmtAll
   - Ensure all generated Scala files are properly formatted

2. **Run lint checks**
   - Run: sbt check
   - Verify all lint checks pass

3. **Update sidebars.js** (if it exists)
   - ${sidebarNote}
   - Ensure proper nesting and alphabetical ordering
   - The entry should link to docs/guides/${outputFileName}.md

4. **Update docs/index.md** (if it exists)
   - Add cross-reference to the new ${docType}
   - Link to: guides/${outputFileName}

5. **Update related documentation**
   - ${crossRefNote}

Report final status and any updates made.`;

  await session.prompt(integratePrompt);
}
