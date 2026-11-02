import { faker } from '@faker-js/faker';
import { ContentType } from '@package/enums/content-type';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { HTTP_SERVER, OAUTH2_CLIENT_ID, OAUTH2_CLIENT_SECRET, OAUTH2_SERVER, test } from '@package/misc/fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

const query = '{ characters { results { name } } }';
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test('Verify GraphQL Request Sends the OAuth 2.0 Header Until Authentication Is Set to None', async ({ user }) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

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

  expect(authenticatedResponse.statusBar.code).toBe(200);
  expect(authenticatedResponse.preview).toMatchObject({
    headers: expect.objectContaining({
      authorization: `Bearer ${tokens.accessToken}`,
    }),
  });
  expect(unauthenticatedResponse.statusBar.code).toBe(200);
  expect((unauthenticatedResponse.preview as { headers: Record<string, string> }).headers).not.toHaveProperty(
    'authorization',
  );
});
