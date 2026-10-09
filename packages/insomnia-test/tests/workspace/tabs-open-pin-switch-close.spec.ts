import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify pinning, switching, closing, and adding tabs in the tab bar", async ({
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
    method: HttpMethod.Post,
    url: `${HTTP_SERVER}/post`,
  });
  await httpRequestFlow.get(requestA.name);
  await workspacePage.pinTab(requestA.name);
  await httpRequestFlow.get(requestB.name);
  const namesAfterOpeningBoth = await workspacePage.getTabNames();
  const activeAfterOpeningB = await workspacePage.getActiveTabName();

  await workspacePage.clickTab(requestA.name);
  const activeAfterClickingA = await workspacePage.getActiveTabName();

  await workspacePage.closeTab(requestB.name);
  const namesAfterClosingB = await workspacePage.getTabNames();
  const isBOpenAfterClose = await workspacePage.isTabOpen(requestB.name);

  await workspacePage.addRequestToCurrentCollection();
  const namesAfterAddingTab = await workspacePage.getTabNames();

  expect(namesAfterOpeningBoth).toEqual([requestA.name, requestB.name]);
  expect(activeAfterOpeningB).toBe(requestB.name);
  expect(activeAfterClickingA).toBe(requestA.name);
  expect(namesAfterClosingB).toEqual([requestA.name]);
  expect(isBOpenAfterClose).toBe(false);
  expect(namesAfterAddingTab).toHaveLength(2);
  expect(namesAfterAddingTab).toContain(requestA.name);
});
