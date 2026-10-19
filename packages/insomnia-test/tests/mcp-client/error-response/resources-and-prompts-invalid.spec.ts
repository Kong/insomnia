import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { connectTo, skippedTitle, wholeFailureTitle } from './helpers';

test('Verify Invalid resources/list and prompts/list Are Reported Like tools/list', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const client = await connectTo(user, {
    'resources/list': {
      result: {
        resources: [
          { uri: 'file:///valid.txt', name: 'valid-resource' },
          { name: 'no-uri-resource' },
          { uri: 42, name: 'numeric-uri-resource' },
        ],
      },
    },
    'prompts/list': { result: { prompts: 'none' } },
  });

  const resourcesError = await mcpClientFlow.getListError(client, 'resources');
  expect(resourcesError.title).toMatch(skippedTitle(2));
  expect(resourcesError.entries.map(entry => entry.label)).toEqual(['no-uri-resource', 'numeric-uri-resource']);
  await expect
    .poll(() => mcpClientPage.getPrimitives('resources'), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual(['valid-resource']);

  expect(await mcpClientFlow.getListError(client, 'prompts')).toEqual({
    title: wholeFailureTitle('prompts/list'),
    entries: [],
  });
  expect(await mcpClientPage.getPrimitives('prompts')).toEqual([]);
});

test('Verify a prompts/list Whose prompts Is an Object Is a Whole-Response Error', async ({ user }) => {
  const client = await connectTo(user, {
    'prompts/list': { result: { prompts: {} } },
  });

  expect(await user.flowManager.mcpClientFlow.getListError(client, 'prompts')).toEqual({
    title: wholeFailureTitle('prompts/list'),
    entries: [],
  });
});

test('Verify a Prompt with Bad arguments Is Skipped While Valid Prompts Are Listed', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const client = await connectTo(user, {
    'prompts/list': {
      result: {
        prompts: [{ name: 'valid-prompt' }, { name: 'bad-args-prompt', arguments: 'x' }],
      },
    },
  });

  const error = await mcpClientFlow.getListError(client, 'prompts');
  expect(error.title).toMatch(skippedTitle(1));
  expect(error.entries.map(entry => entry.label)).toEqual(['bad-args-prompt']);
  await expect
    .poll(() => user.pageManager.mcpClientPage.getPrimitives('prompts'), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual(['valid-prompt']);
});
