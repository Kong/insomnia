import { expect, test } from '../../../misc/fixtures';
import { connectTo, wholeFailureTitle } from './helpers';

const wholeInvalidTools: Record<string, unknown> = {
  'tools is not an array': { tools: 'not-an-array' },
  'tools is null': { tools: null },
  'nextCursor has the wrong type': { tools: [], nextCursor: 123 },
};

for (const [variant, result] of Object.entries(wholeInvalidTools)) {
  test(`Verify a Whole tools/list Response Invalid (${variant}) Shows a Title-Only Error`, async ({ user }) => {
    const { mcpClientFlow } = user.flowManager;
    const client = await connectTo(user, { 'tools/list': { result } });

    expect(await mcpClientFlow.getListError(client, 'tools')).toEqual({
      title: wholeFailureTitle('tools/list'),
      entries: [],
    });
    expect(await user.pageManager.mcpClientPage.getPrimitives('tools')).toEqual([]);
  });
}

test('Verify a tools/list Result That Is Not an Object Shows an Error and Lists No Tools', async ({ user }) => {
  const client = await connectTo(user, { 'tools/list': { result: 'oops' } });

  // The MCP SDK rejects a non-object `result` before the pane's own
  // validation runs, so the title is the SDK's ZodError, not the agreed
  // "does not match the MCP schema" wording.
  const error = await user.flowManager.mcpClientFlow.getListError(client, 'tools');
  expect(error.title).not.toBe('');
  expect(error.entries).toEqual([]);
  expect(await user.pageManager.mcpClientPage.getPrimitives('tools')).toEqual([]);
});
