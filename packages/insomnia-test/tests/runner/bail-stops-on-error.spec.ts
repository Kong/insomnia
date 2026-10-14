import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

const url = `${HTTP_SERVER}/post`;
const brokenUrl = `${HTTP_SERVER}/post?x={% nosuchtag %}`;

test('Verify Runner Bail Option Stops the Run at the First Request Error', async ({ user }) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { runnerPage } = user.pageManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const continuingCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));
  const bailingCollection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const [first, broken, last] = Array.from({ length: 3 }, () => faker.string.alphanumeric(10));
  for (const collection of [continuingCollection, bailingCollection]) {
    await httpRequestFlow.create(collection, {
      name: last,
      method: HttpMethod.Post,
      url,
    });
    await httpRequestFlow.create(collection, {
      name: broken,
      method: HttpMethod.Post,
      url: brokenUrl,
    });
    await httpRequestFlow.create(collection, {
      name: first,
      method: HttpMethod.Post,
      url,
    });
  }

  const continuingResult = await workspaceFlow.run(continuingCollection, {
    iterations: 2,
    delay: 0,
    bail: false,
  });
  await workspaceFlow.openRunner(bailingCollection, {
    iterations: 2,
    delay: 0,
    bail: true,
  });
  await runnerPage.clickRun();

  const continuingIterations = continuingResult.iterationResults.get('All')!;
  expect(continuingIterations).toHaveLength(2);
  for (const iteration of continuingIterations) {
    expect(iteration.results.map(({ name, status }) => ({ name, status }))).toEqual([
      { name: first, status: '200 OK' },
      { name: broken, status: 'ERROR' },
      { name: last, status: '200 OK' },
    ]);
  }
  await expect
    .poll(async () =>
      (await runnerPage.getIterationResults()).map(iteration =>
        iteration.results.map(({ name, status }) => ({ name, status })),
      ),
    )
    .toEqual([
      [
        { name: first, status: '200 OK' },
        { name: broken, status: 'ERROR' },
      ],
    ]);
});
