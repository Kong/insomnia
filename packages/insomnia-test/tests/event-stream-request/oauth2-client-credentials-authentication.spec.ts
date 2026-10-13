import { faker } from '@faker-js/faker';

import { ProjectType } from '../../enums/project-types';
import {
  DEFAULT_TIMEOUT,
  EVENT_STREAM_SERVER,
  expect,
  OAUTH2_CLIENT_ID,
  OAUTH2_CLIENT_SECRET,
  OAUTH2_SERVER,
  test,
} from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { EventStreamMethod } from '../../models/event-stream-request';
import { Project } from '../../models/project';

test('Verify Event Stream Request Sends the OAuth 2.0 Header Until Authentication Is Set to None', async ({ user }) => {
  const { eventStreamRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const request = await eventStreamRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: EventStreamMethod.Get,
    url: `${EVENT_STREAM_SERVER}/sse-events/1`,
    authentication: {
      type: 'oauth2',
      grantType: 'client_credentials',
      accessTokenUrl: `${OAUTH2_SERVER}/token`,
      clientId: OAUTH2_CLIENT_ID,
      clientSecret: OAUTH2_CLIENT_SECRET,
    },
  });
  const tokens = await eventStreamRequestFlow.fetchOAuth2Tokens(request);
  const authenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => authenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain(`Authorization: Bearer ${tokens.accessToken}`);

  await eventStreamRequestFlow.setAuthentication(request, { type: 'none' });
  const unauthenticatedResponse = await eventStreamRequestFlow.send(request);

  await expect
    .poll(() => unauthenticatedResponse.console?.(), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toContain('GET /sse-events/1');
  expect(await unauthenticatedResponse.console?.()).not.toContain('Authorization:');
});
