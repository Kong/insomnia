import { expect, test } from '../../../misc/fixtures';
import { connectTo, validTool } from './helpers';

test('Verify Invalid Entries With the Same Name and Issue Are All Listed Without Duplicate Key Warnings', async ({
  user,
}) => {
  const { mcpClientFlow } = user.flowManager;

  const client = await connectTo(user, {
    'tools/list': { result: { tools: [validTool, { name: 'dup' }, { name: 'dup' }] } },
  });

  const error = await mcpClientFlow.getListError(client, 'tools');
  expect(error.entries.map(entry => entry.label)).toEqual(['dup', 'dup']);
});
