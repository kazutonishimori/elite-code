/** Keeps the complete examples in PROBLEM_AUTHORING.md identical to schema/examples/*.json. */
const BLOCK = /(<!-- BEGIN EXAMPLE ([a-z0-9-]+) -->)[\s\S]*?(<!-- END EXAMPLE -->)/g;

export function injectExamples(guide: string, examples: Record<string, string>): string {
  return guide.replace(BLOCK, (_match, begin: string, id: string, end: string) => {
    const json = examples[id];
    if (json === undefined) throw new Error(`No example file for "${id}"`);
    return `${begin}\n\n\`\`\`json\n${json.trimEnd()}\n\`\`\`\n\n${end}`;
  });
}

/** Every fenced ```json block that looks like a complete problem document. */
export function extractProblemBlocks(guide: string): string[] {
  return [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)]
    .map((m) => m[1] ?? '')
    .filter((block) => block.includes('"schemaVersion"'));
}
