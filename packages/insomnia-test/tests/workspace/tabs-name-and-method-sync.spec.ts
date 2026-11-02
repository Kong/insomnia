import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Project } from "@package/models/project";

test("Verify a tab's label and method icon stay in sync with the underlying request, and its tab auto-closes when the request is deleted", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.createProject(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.createCollection(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  await httpRequestFlow.get(request.name);

  const renamedName = faker.string.alphanumeric(10);
  const renamedRequest = await workspaceFlow.renameRequest(request, renamedName);
  const namesAfterRename = await workspacePage.getTabNames();

  await httpRequestPage.setMethod(HttpMethod.Post);
  const methodTagAfterChange = await workspacePage.getTabMethodTag(renamedName);

  await workspaceFlow.delete(renamedRequest);

  expect(namesAfterRename).toEqual([renamedName]);
  expect(methodTagAfterChange).toBe(HttpMethod.Post);
  await expect
    .poll(async () => workspacePage.isTabOpen(renamedName), { timeout: 10_000 })
    .toBe(false);
});
