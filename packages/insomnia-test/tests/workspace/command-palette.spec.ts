import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify command palette fuzzy-jumps between requests and collections", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { httpRequestPage, workspacePage, commandPalettePage } =
    user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collectionA = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const collectionB = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestA = await httpRequestFlow.create(collectionA, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const requestB = await httpRequestFlow.create(collectionB, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  });
  await httpRequestFlow.get(requestA.name);

  const requestResults = await workspaceFlow.search(requestB.name);
  await commandPalettePage.selectResult(requestB.name);
  const urlAfterRequestJump = await httpRequestPage.getUrl();
  const methodAfterRequestJump = await httpRequestPage.getMethod();

  const collectionResults = await workspaceFlow.search(collectionA.name);
  await commandPalettePage.selectResult(collectionA.name);
  const breadcrumbAfterCollectionJump =
    await workspacePage.waitForBreadcrumbSettled([
      project.name,
      collectionA.name,
    ]);

  await commandPalettePage.openViaShortcut();
  await commandPalettePage.close();

  expect(requestResults.some((r) => r.includes(requestB.name))).toBe(true);
  expect(urlAfterRequestJump).toBe(requestB.url);
  expect(methodAfterRequestJump.trim()).toBe(requestB.method);
  expect(collectionResults.some((r) => r.includes(collectionA.name))).toBe(
    true,
  );
  expect(breadcrumbAfterCollectionJump).toEqual([
    project.name,
    collectionA.name,
  ]);
});
