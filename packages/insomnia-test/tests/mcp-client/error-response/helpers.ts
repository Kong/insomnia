export const validTool = { name: 'valid-tool', inputSchema: { type: 'object' } };
export const wholeFailureTitle = (method: string) =>
  `The server returned a ${method} response that does not match the MCP schema.`;
// The wording of the skipped-entries title is still being settled (INS-3647
// notes): accept either the primitive name or "entries" as the noun.
export const skippedTitle = (count: number) =>
  new RegExp(
    `^${count} (entries|entry|tools?|resources?|prompts?) (was|were) skipped because they do not match the MCP schema\\.$`,
  );
