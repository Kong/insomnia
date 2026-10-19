import { expect, test } from '../../../misc/fixtures';
import { connectTo } from './helpers';

test('Verify a JSON-RPC Error Whose Message Is a JSON String Is Shown Readably', async ({ user }) => {
  const client = await connectTo(user, {
    'tools/list': { error: { code: -32_603, message: "{ detail: 'boom' }" } },
  });

  const error = await user.flowManager.mcpClientFlow.getListError(client, 'tools');

  expect(error.title).toContain('boom');
  expect(error.title).not.toContain('[object Object]');
});
