import { expect, test } from '../../../misc/fixtures';
import { connectTo, validTool } from './helpers';

test('Verify an Entry Without a Usable Name Is Labeled by Its Position and Shows Its First Issue', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const client = await connectTo(user, {
    'tools/list': {
      result: {
        tools: [validTool, 42, 'just-a-string', null, { name: 123, description: 456, inputSchema: 'not-an-object' }],
      },
    },
  });

  const error = await mcpClientFlow.getListError(client, 'tools');
  expect(error.entries.map(entry => entry.label)).toEqual(['index 1', 'index 2', 'index 3', 'index 4']);
  expect(error.entries[3].reason).toMatch(/\(And \d+ more\)$/);
});

test('Verify a Long Error Panel Scrolls Inside Its Own Area Without Overlapping the Next Row', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const badTools = Array.from({ length: 12 }, (_, i) => ({ name: `bad-${i + 1}` }));
  const client = await connectTo(user, {
    'tools/list': { result: { tools: [validTool, ...badTools] } },
    'prompts/list': { result: { prompts: [{ name: 'valid-prompt' }] } },
  });

  const error = await mcpClientFlow.getListError(client, 'tools');
  expect(error.entries).toHaveLength(12);
  expect(await mcpClientPage.isCapabilityErrorScrollable('tools')).toBe(true);

  const panelBox = await mcpClientPage.getCapabilityErrorBounds('tools');
  const nextCapabilityBox = await mcpClientPage.getCapabilityBounds('prompts');
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(nextCapabilityBox.y + 1);
});
