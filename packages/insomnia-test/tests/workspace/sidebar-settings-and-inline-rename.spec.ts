import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ContextMenuItem } from "@package/enums/context-menu-items";
import { HttpMethod } from "@package/enums/http-method";
import { ProjectType } from "@package/enums/project-types";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { HTTP_SERVER, test } from "@package/misc/fixtures";
import { Collection } from "@package/models/collection";
import { Folder } from "@package/models/folder";
import { Project } from "@package/models/project";

test("Verify per-node-type Settings dialogs and inline rename via the sidebar", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, folderFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

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
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );

  const requestNode = await workspacePage.findItemNode(
    request,
    TreeNodeType.Request,
  );
  await workspacePage.rightClick(requestNode!);
  await workspacePage.clickContextMenu(ContextMenuItem.Settings);
  const isRequestSettingsOpen =
    await workspacePage.isModalOpen("Request Settings");
  const isRequestSettingsNameFocused = await workspacePage.isFocused(
    user.page.getByRole("dialog").getByRole("textbox", { name: "Name" }),
  );
  await workspacePage.closeModal();

  const collectionNode = await workspacePage.findItemNode(collection);
  await workspacePage.rightClick(collectionNode!);
  await workspacePage.clickContextMenu(ContextMenuItem.Settings);
  const isCollectionSettingsOpen = await workspacePage.isModalOpen(
    "Collection Settings",
  );
  const isCollectionSettingsNameFocused = await workspacePage.isFocused(
    user.page.getByRole("dialog").getByRole("textbox", { name: "Name" }),
  );
  await workspacePage.closeModal();

  const folderNode = await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
  );
  await workspacePage.rightClick(folderNode!);
  await workspacePage.clickContextMenu(ContextMenuItem.Settings);
  const isFolderSettingsOpen = await workspacePage.isModalOpen(
    "Folder Settings",
  );
  const isFolderSettingsNameFocused = await workspacePage.isFocused(
    user.page.getByRole("dialog").getByRole("textbox", { name: "Name" }),
  );
  await workspacePage.closeModal();

  const renamedName = faker.string.alphanumeric(10);
  await workspacePage.renameRequestInline(request.name, renamedName);
  const namesAfterInlineRename = (await workspacePage.getNodes()).map(
    (n) => n.name,
  );

  expect(isRequestSettingsOpen).toBe(true);
  expect(isRequestSettingsNameFocused).toBe(true);
  expect(isCollectionSettingsOpen).toBe(true);
  expect(isCollectionSettingsNameFocused).toBe(true);
  expect(isFolderSettingsOpen).toBe(true);
  expect(isFolderSettingsNameFocused).toBe(true);
  expect(namesAfterInlineRename).toContain(renamedName);
  expect(namesAfterInlineRename).not.toContain(request.name);
});
