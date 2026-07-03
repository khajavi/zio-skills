export function buildIntegratePrompt(options: {
  outputFileName: string;
  topic: string;
  docType: 'tutorial' | 'how-to-guide' | 'data-type-ref' | 'module-ref';
}): string {
  const { outputFileName, topic, docType } = options;

  const isRef = docType === 'data-type-ref' || docType === 'module-ref';
  const linkPrefix = isRef ? 'reference' : 'guides';

  let sidebarNote: string;
  switch (docType) {
    case 'tutorial':
      sidebarNote = `Add entry for ${outputFileName} under the "Guides" category (not "Reference")`;
      break;
    case 'how-to-guide':
      sidebarNote = `Add entry for ${outputFileName} under the "Guides" category (not "Reference" or "Tutorials") — create the "Guides" category if it doesn't exist`;
      break;
    case 'data-type-ref':
      sidebarNote = `Add \`{ type: "doc", id: "reference/${outputFileName}" }\` under the "Reference" category — ensure proper alphabetical ordering`;
      break;
    case 'module-ref':
      sidebarNote = `Flat structure: add \`{ type: "doc", id: "reference/${outputFileName}" }\` under the "Reference" category\n   - Hierarchical structure: add a category entry with link to index and items for each type page`;
      break;
  }

  let crossRefNote: string;
  switch (docType) {
    case 'tutorial':
      crossRefNote = `Check if other reference pages or how-to guides should link to this tutorial
   - Add reciprocal cross-references where appropriate
   - Tutorials should link from "Where to Go Next" to related how-to guides`;
      break;
    case 'how-to-guide':
      crossRefNote = `Check if reference pages for types used in this guide should link back to the guide
   - Add reciprocal cross-references where appropriate (e.g., if the guide covers Schema, add a "See also" link from docs/reference/schema.md)`;
      break;
    case 'data-type-ref':
    case 'module-ref':
      crossRefNote = `Check if other reference pages should link to ${topic}
   - Add reciprocal cross-references where appropriate`;
      break;
  }

  return `**Phase 4: Integrate**

Integrate the ${docType} for ${topic} into the docs structure.

**Integration steps:**

1. **Update sidebars.js** (if it exists)
   - ${sidebarNote}

2. **Update docs/index.md** (if it exists)
   - Add cross-reference to the new ${docType}
   - Link to: ${linkPrefix}/${outputFileName}

3. **Update related documentation**
   - ${crossRefNote}

Report final status and any updates made.`;
}
