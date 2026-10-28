import { faker } from '@faker-js/faker';

import { ContextMenuItem } from '../../enums/context-menu-items';
import { ProjectType } from '../../enums/project-types';
import { expect, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test("Verify adding a query parameter or header focuses the new row's Name cell", async ({ user }) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, httpRequestPage } = user.pageManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const collection = await workspaceFlow.create(project, new Collection(faker.string.alphanumeric(10)));

  const collectionNode = await workspacePage.resolveNode(collection);
  await workspacePage.rightClick(collectionNode);
  await workspacePage.clickContextMenu(ContextMenuItem.HttpRequest);
  await httpRequestPage.navigate();

  // Focus moves to the new row asynchronously, so poll rather than sample once.
  const paramNameContainer = await httpRequestPage.addParam();
  await expect.poll(() => httpRequestPage.hasFocus(paramNameContainer)).toBe(true);
  const headerNameContainer = await httpRequestPage.addHeader();
  await expect.poll(() => httpRequestPage.hasFocus(headerNameContainer)).toBe(true);
});

test("Verify opening a brand-new empty environment focuses its key/value editor's blank row Name cell", async ({
  user,
}) => {
  const { workspaceFlow } = user.flowManager;
  const { workspacePage, environmentPage } = user.pageManager;

  const project = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
  const node = await workspacePage.resolveNode(project);
  await workspacePage.rightClick(node);
  await workspacePage.clickContextMenu(ContextMenuItem.Environment);

  await workspacePage.setNewItemName(faker.string.alphanumeric(10));
  await workspacePage.clickCreate();

  const blankRowFocused = await environmentPage.hasFocus(environmentPage.blankRowNameContainer);

  expect(blankRowFocused).toBe(true);
});
