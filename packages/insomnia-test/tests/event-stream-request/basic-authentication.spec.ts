import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import { DEFAULT_TIMEOUT, EVENT_STREAM_SERVER, expect, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { EventStreamMethod } from '../../models/event-stream-request';
import { Project } from '../../models/project';

test('Verify Event Stream Request Sends the Basic Authentication Header Until Authentication Is Set to None', async ({
  user,
}) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const username = faker.string.alphanumeric(8);
  const password = faker.string.alphanumeric(12);
  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/sse-events/1`,
    authentication: { type: 'basic', username, password },
  });
  const authenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => authenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(`Authorization: Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`);

  await eventStreamRequestFlow.setAuthentication(request, { type: 'none' });
  const unauthenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => unauthenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain('GET /sse-events/1');
  expect(await unauthenticatedResponse.console?.()).not.toContain('Authorization:');
});
