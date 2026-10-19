import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { connectTo, skippedTitle, validTool } from './helpers';

const partialInvalidTools: Record<string, { tools: unknown[]; skipped: string[] }> = {
  'missing or invalid inputSchema': {
    tools: [
      { ...validTool, description: 'ok', inputSchema: { type: 'object', properties: {} } },
      { name: 'no-schema-tool', description: 'missing inputSchema' },
      { name: 'bad-schema-tool', inputSchema: { type: 'string' } },
    ],
    skipped: ['no-schema-tool', 'bad-schema-tool'],
  },
  'missing or non-string name': {
    tools: [validTool, { inputSchema: { type: 'object' } }, { name: 123, inputSchema: { type: 'object' } }],
    skipped: ['index 1', 'index 2'],
  },
};

for (const [variant, { tools, skipped }] of Object.entries(partialInvalidTools)) {
  test(`Verify a Partially Invalid tools/list (${variant}) Skips the Bad Entries and Lists Them`, async ({ user }) => {
    const { mcpClientFlow } = user.flowManager;
    const { mcpClientPage } = user.pageManager;
    const client = await connectTo(user, { 'tools/list': { result: { tools } } });

    const error = await mcpClientFlow.getListError(client, 'tools');
    expect(error.title).toMatch(skippedTitle(2));
    expect(error.entries.map(entry => entry.label)).toEqual(skipped);
    for (const entry of error.entries) {
      expect(entry.reason).not.toBe('');
    }
    await expect
      .poll(() => mcpClientPage.getPrimitives('tools'), {
        timeout: DEFAULT_TIMEOUT,
      })
      .toEqual(['valid-tool']);
  });
}
