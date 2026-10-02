import { faker } from "@faker-js/faker";

import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify arrow keys expand and collapse a sidebar folder", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const folderNode = (await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
  ))!;

  await workspacePage.collapse(folderNode);
  await workspacePage.expand(folderNode);
  const expandedAfterArrowRight = await workspacePage.isExpanded(folderNode);

  await workspacePage.collapse(folderNode);
  const expandedAfterArrowLeft = await workspacePage.isExpanded(folderNode);

  expect(expandedAfterArrowRight).toBe(true);
  expect(expandedAfterArrowLeft).toBe(false);
});

test("Verify Cmd/Ctrl+N opens the create menu targeted at the selected folder", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const folderNode = (await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
  ))!;

  await workspacePage.openCreateShortcut(folderNode);
  const menuOpenAfterShortcut = await workspacePage.isCreateShortcutShown();

  expect(menuOpenAfterShortcut).toBe(true);
});
