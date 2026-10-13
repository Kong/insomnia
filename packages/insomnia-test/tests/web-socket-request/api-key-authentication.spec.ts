import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { DEFAULT_TIMEOUT, expect, test, WS_SERVER } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test('Verify WebSocket Connection Sends the API Key Header Until Authentication Is Set to None', async ({ user }) => {
  const { webSocketRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const apiKeyName = `x-${faker.string.alphanumeric(8).toLowerCase()}`;
  const apiKeyValue = faker.string.alphanumeric(16);
  const request = await webSocketRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    url: WS_SERVER,
    authentication: { type: 'apikey', key: apiKeyName, value: apiKeyValue },
  });
  await webSocketRequestFlow.send(request);
  const authenticatedResponse = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => authenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(`${apiKeyName}: ${apiKeyValue}`);

  await webSocketRequestFlow.setAuthentication(request, { type: 'none' });
  await webSocketRequestFlow.send(request);
  const unauthenticatedResponse = await webSocketRequestFlow.disconnect(request);

  await expect
    .poll(() => unauthenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain('host:');
  expect(await unauthenticatedResponse.console?.()).not.toContain(apiKeyName);
});
