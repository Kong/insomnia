import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { connectTo } from './helpers';

test('Verify Load More Whose Next Page Has an Invalid Entry Lists the Skipped Entry in the Error Panel', async ({
  user,
}) => {
  test.fail(true, "INS-4064");
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const client = await connectTo(user, {
    'resources/list': {
      pages: {
        '': {
          result: {
            resources: [{ name: 'item-1', uri: 'file:///item-1.txt' }],
            nextCursor: 'page-2',
          },
        },
        'page-2': {
          result: {
            resources: [{ name: 'item-2', uri: 'file:///item-2.txt' }, { name: 'bad-resource' }],
          },
        },
      },
    },
  });
  await expect.poll(() => mcpClientPage.getPrimitives('resources'), { timeout: DEFAULT_TIMEOUT }).toEqual(['item-1']);

  await mcpClientFlow.loadMore(client, 'resources');
  await expect
    .poll(() => mcpClientPage.getPrimitives('resources'), { timeout: DEFAULT_TIMEOUT })
    .toEqual(['item-1', 'item-2']);
  const error = await mcpClientFlow.getListError(client, 'resources');

  expect(error.entries.map(entry => entry.label)).toEqual(['bad-resource']);
});
