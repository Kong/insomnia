import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify sidebar filtering hides non-matching requests and pinning toggles from the context menu", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const requestA = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const requestB = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  await workspacePage.filterSidebar(requestA.name);
  const namesWhileFiltered = (await workspacePage.getNodes()).map(
    (n) => n.name,
  );

  await workspacePage.clearSidebarFilter();
  const namesAfterClear = (await workspacePage.getNodes()).map((n) => n.name);

  await workspaceFlow.pin(requestA);
  await expect
    .poll(async () => workspacePage.isPinned(requestA.name), {
      timeout: 10_000,
    })
    .toBe(true);

  await workspaceFlow.pin(requestA);
  await expect
    .poll(async () => workspacePage.isPinned(requestA.name), {
      timeout: 10_000,
    })
    .toBe(false);

  expect(namesWhileFiltered).toContain(requestA.name);
  expect(namesWhileFiltered).not.toContain(requestB.name);
  expect(namesAfterClear).toContain(requestA.name);
  expect(namesAfterClear).toContain(requestB.name);
});
