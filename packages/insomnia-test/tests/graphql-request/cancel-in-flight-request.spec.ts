import { faker } from '@faker-js/faker';

import { ContentType } from '../../enums/content-type';
import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { RequestState } from '../../enums/request-state';
import { DEFAULT_TIMEOUT, expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const query = '{ characters { results { name } } }';
const body = { mimeType: ContentType.JSON, text: JSON.stringify({ query }) };

test('Verify Cancelling an In-Flight GraphQL Request Shows a Cancellation Message and a Later Request Still Succeeds', async ({
  user,
}) => {
  const { graphqlRequestFlow, workspaceFlow } = user.flowManager;
  const { graphqlRequestPage, responsePage } = user.pageManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

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
  expect(cancelledResponse.statusCode).toBeUndefined();
  expect(laterResponse.statusCode).toBe(200);
});
