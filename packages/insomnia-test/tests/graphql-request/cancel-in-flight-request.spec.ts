import { faker } from '@faker-js/faker';
import { expect } from "@playwright/test";

import { ContentType } from '@package/enums/content-type';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { RequestState } from '@package/enums/request-state';
import { DEFAULT_TIMEOUT, HTTP_SERVER, test } from '@package/misc/fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';

const query = '{ characters { results { name } } }';
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test('Verify Cancelling an In-Flight GraphQL Request Shows a Cancellation Message and a Later Request Still Succeeds', async ({
  user,
}) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;
  const { graphqlRequestPage, responsePage } = user.pageManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

  const slowRequest = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/graphql`,
    body,
    headers: [{ name: 'x-reply-delay-ms', value: '10000' }],
  });
  const laterRequest = await graphqlRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/graphql`,
    body,
  });

  await graphqlRequestFlow.get(slowRequest.name);
  await graphqlRequestPage.send();
  await expect.poll(() => responsePage.getRequestState(), { timeout: DEFAULT_TIMEOUT }).toBe(RequestState.Sending);
  await responsePage.cancelRequest();
  await expect
    .poll(() => responsePage.hasMessage('Request was cancelled'), {
      timeout: DEFAULT_TIMEOUT,
    })
    .toBe(true);
  const requestStateAfterCancel = await responsePage.getRequestState();
  const cancelledResponse = await responsePage.get();

  const laterResponse = await graphqlRequestFlow.send(laterRequest);

  expect(requestStateAfterCancel).toBe(RequestState.Idle);
  expect(cancelledResponse.statusBar.code).toBeUndefined();
  expect(laterResponse.statusBar.code).toBe(200);
});
