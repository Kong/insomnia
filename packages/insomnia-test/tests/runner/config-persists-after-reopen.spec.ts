import { faker } from '@faker-js/faker';
import { HttpMethod } from '@package/enums/http-method';
import { ProjectType } from '@package/enums/project-types';
import { HTTP_SERVER, test } from '@package/misc/fixtures';
import { Collection } from '@package/models/collection';
import { Project } from '@package/models/project';
import { expect } from "@playwright/test";

const iterations = 5;

test('Verify Runner Iterations Setting Persists After Leaving and Reopening the Runner', async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { runnerPage } = user.pageManager;

  const project = await workspaceFlow.createProject(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.createCollection(project, new Collection(faker.string.alphanumeric(10)));

  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  });

  await workspaceFlow.openRunner(collection, { iterations, delay: 700, bail: false });
  await httpRequestFlow.get(request);
  await workspaceFlow.openRunner(collection);

  expect(await runnerPage.getIterations()).toBe(iterations);
});
