import { expect, test } from '../../../misc/fixtures';
import { connectTo, validTool } from './helpers';

test('Verify the Error Panel of a Partially Invalid List Follows Expand and Collapse', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const client = await connectTo(user, {
    'tools/list': {
      result: { tools: [validTool, { name: 'no-schema-tool' }] },
    },
    'prompts/list': { result: { prompts: [{ name: 'valid-prompt' }] } },
  });
  await mcpClientFlow.getListError(client, 'tools');
  await expect.poll(() => mcpClientPage.hasCapability('prompts')).toBe(true);

  const panelBox = await mcpClientPage.getCapabilityErrorBounds('tools');
  const nextCapabilityBox = await mcpClientPage.getCapabilityBounds('prompts');
  expect(panelBox.y + panelBox.height).toBeLessThanOrEqual(nextCapabilityBox.y + 1);

  await mcpClientFlow.toggleCapability(client, 'tools');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('tools')).toBe(0);

  await mcpClientFlow.toggleCapability(client, 'tools');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('tools')).toBe(1);
});

test('Verify the Error Panel of an Empty List Stays Visible Without a Collapse Caret', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const client = await connectTo(user, {
    'tools/list': { result: { tools: 'not-an-array' } },
  });
  await mcpClientFlow.getListError(client, 'tools');

  expect(await mcpClientPage.hasCaret('tools')).toBe(false);
  await mcpClientFlow.toggleCapability(client, 'tools');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('tools')).toBe(1);
});
