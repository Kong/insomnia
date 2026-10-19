import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { connectTo, validTool } from './helpers';

test('Verify a Server-Initiated Request Reusing the tools/list Request Id Does Not Produce a Tools Error', async ({
  user,
}) => {
  test.fail(true, "INS-4066");
  const { mcpClientPage } = user.pageManager;
  await connectTo(user, {
    'tools/list': { result: { tools: [validTool] } },
    'serverRequestReusingToolsListId': true,
  });

  await expect.poll(() => mcpClientPage.getPrimitives('tools'), { timeout: DEFAULT_TIMEOUT }).toEqual(['valid-tool']);
  expect(await mcpClientPage.getCapabilityErrorCount('tools')).toBe(0);
});
