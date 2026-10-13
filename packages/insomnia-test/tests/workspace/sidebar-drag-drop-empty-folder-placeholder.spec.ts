import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";
import type { TreeNode } from "../../pages/workspace.page";

test("Verify dragging an item onto an empty folder's placeholder makes it that folder's child", async ({
  user,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const emptyFolder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const standaloneRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const emptyFolderNode = (await workspacePage.findItemNode(
    { name: emptyFolder.name, id: emptyFolder.id },
    TreeNodeType.Folder,
  ))!;
  const standaloneRequestNode = (await workspacePage.findItemNode(
    { name: standaloneRequest.name, id: standaloneRequest.id },
    TreeNodeType.Request,
  ))!;
  await workspacePage.expand(emptyFolderNode);
  const placeholderRow: TreeNode = {
    _id: `empty-folder-${emptyFolder.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(standaloneRequestNode);
  await workspacePage.dragOver(placeholderRow, 0.7, 0.25);
  const indicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  await workspacePage.expand(emptyFolderNode);
  const treeAfterDrag = await workspacePage.getTree();
  const emptyFolderAfterDrag = treeAfterDrag
    .flatten()
    .find((n) => n._id === emptyFolderNode._id)!;
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;
  const collectionChildrenAfterDrag = treeAfterDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;

  expect(indicator?.isValid).toBe(true);
  expect(emptyFolderAfterDrag.children.map((c) => c._id)).toEqual([
    standaloneRequestNode._id,
  ]);
  expect(
    collectionChildrenAfterDrag.some((n) => n._id === standaloneRequestNode._id),
  ).toBe(false);
});
