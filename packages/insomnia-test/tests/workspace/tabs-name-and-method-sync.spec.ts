import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify a tab's label and method icon stay in sync with the underlying request, and its tab auto-closes when the request is deleted", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
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
  const renamedRequest = await workspaceFlow.rename(request, renamedName);
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
