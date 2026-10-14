import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const url = `${HTTP_SERVER}/post`;
const delay = 1000;
const requestCount = 3;

test('Verify Runner Delay Option Waits Between Requests', async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  for (let i = 0; i < requestCount; i++) {
    await httpRequestFlow.create(collection, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Post,
      url,
    });
  }

  const noDelayStart = Date.now();
  const noDelayResult = await workspaceFlow.run(collection, {
    iterations: 1,
    delay: 0,
  });
  const noDelayElapsed = Date.now() - noDelayStart;
  const delayedStart = Date.now();
  const delayedResult = await workspaceFlow.run(collection, {
    iterations: 1,
    delay,
  });
  const delayedElapsed = Date.now() - delayedStart;

  expect(noDelayResult.iterationResults.get('All')![0].results).toHaveLength(requestCount);
  expect(delayedResult.iterationResults.get('All')![0].results).toHaveLength(requestCount);
  expect(delayedElapsed).toBeGreaterThanOrEqual((requestCount - 1) * delay);
  expect(delayedElapsed).toBeGreaterThan(noDelayElapsed);
});
