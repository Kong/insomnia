import { faker } from '@faker-js/faker';

import { ContentType } from '../../enums/content-type';
import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { expect, HTTP_SERVER, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const query = '{ characters { results { name } } }';
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test('Verify GraphQL Request Sends the OAuth 2.0 Header Until Authentication Is Set to None', async ({ user }) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const request = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
    body,
    authentication: {
      type: 'oauth2',
      grantType: 'client_credentials',
      accessTokenUrl: `${OAUTH2_SERVER}/token`,
      clientId: OAUTH2_CLIENT_ID,
      clientSecret: OAUTH2_CLIENT_SECRET,
    },
  });
  const tokens = await graphqlRequestFlow.fetchOAuth2Tokens(request);
  const authenticatedResponse = await graphqlRequestFlow.send(request);
  await graphqlRequestFlow.setAuthentication(request, { type: 'none' });
  const unauthenticatedResponse = await graphqlRequestFlow.send(request);

  expect(authenticatedResponse.statusCode).toBe(200);
  expect(authenticatedResponse.body).toMatchObject({
    headers: expect.objectContaining({
      authorization: `Bearer ${tokens.accessToken}`,
    }),
  });
  expect(unauthenticatedResponse.statusCode).toBe(200);
  expect((unauthenticatedResponse.body as { headers: Record<string, string> }).headers).not.toHaveProperty(
    'authorization',
  );
});
