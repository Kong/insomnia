import { expect, test } from '../../../misc/fixtures';
import { connectTo } from './helpers';

const jsonRpcErrors = [
  { code: -32_601, message: 'Method not found' },
  { code: -32_603, message: 'Internal error' },
];

for (const rpcError of jsonRpcErrors) {
  test(`Verify a JSON-RPC Error on tools/list (${rpcError.message}) Is Shown`, async ({ user }) => {
    const client = await connectTo(user, {
      'tools/list': { error: rpcError },
    });

    const error = await user.flowManager.mcpClientFlow.getListError(client, 'tools');
    expect(error.title).toContain(rpcError.message);
    expect(error.entries).toEqual([]);
  });
}
