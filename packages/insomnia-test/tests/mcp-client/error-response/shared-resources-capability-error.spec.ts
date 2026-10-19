import { DEFAULT_TIMEOUT, expect, test } from '../../../misc/fixtures';
import { connectTo, wholeFailureTitle } from './helpers';

test('Verify Resources and Resource Templates Errors Share One Capability Item Panel', async ({ user }) => {
  const { mcpClientFlow } = user.flowManager;
  const { mcpClientPage } = user.pageManager;
  const client = await connectTo(user, {
    'resources/list': { result: { resources: null } },
    'resources/templates/list': {
      result: {
        resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'valid-template' }, { name: 'no-uri-template' }],
      },
    },
  });

  const error = await mcpClientFlow.getListError(client, 'resources');
  await expect.poll(() => mcpClientPage.getCapabilityErrorCount('resources')).toBe(1);
  expect(error.title).toContain(wholeFailureTitle('resources/list'));
  expect(error.title).toContain('skipped because they do not match the MCP schema');
  expect(error.entries.map(entry => entry.label)).toEqual(['no-uri-template']);
  await expect
    .poll(() => mcpClientPage.getPrimitives('resourceTemplates'), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toEqual(['valid-template']);
});
