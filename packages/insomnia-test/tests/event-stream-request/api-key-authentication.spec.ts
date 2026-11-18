import { faker } from '@faker-js/faker';
import { ProjectType } from '@package/enums/project-types';
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, test } from '@package/misc/fixtures';
import { Collection } from '@package/models/collection';
import { EventStreamMethod } from '@package/models/event-stream-request';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

test('Verify Event Stream Request Sends the API Key Header Until Authentication Is Set to None', async ({ user }) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

  const apiKeyName = `X-${faker.string.alphanumeric(8)}`;
  const apiKeyValue = faker.string.alphanumeric(16);
  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/sse-events/1`,
    authentication: { type: 'apikey', key: apiKeyName, value: apiKeyValue },
  });
  const authenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => authenticatedResponse.console(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(`${apiKeyName}: ${apiKeyValue}`);

  await eventStreamRequestFlow.setAuthentication(request, { type: 'none' });
  const unauthenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => unauthenticatedResponse.console(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain('GET /sse-events/1');
  expect(await unauthenticatedResponse.console()).not.toContain(apiKeyName);
});
