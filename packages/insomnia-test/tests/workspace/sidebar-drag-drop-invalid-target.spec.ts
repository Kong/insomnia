import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify invalid drop targets are rejected and shown as invalid", async ({
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
  const outerFolder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const innerFolder = await folderFlow.create(
    outerFolder,
    new Folder(faker.string.alphanumeric(10)),
  );
  const firstRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const secondRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const outerFolderNode = (await workspacePage.findItemNode(
    { name: outerFolder.name, id: outerFolder.id },
    TreeNodeType.Folder,
  ))!;
  const innerFolderNode = (await workspacePage.findItemNode(
    { name: innerFolder.name, id: innerFolder.id },
    TreeNodeType.Folder,
    outerFolderNode,
  ))!;
  const firstRequestNode = (await workspacePage.findItemNode(
    { name: firstRequest.name, id: firstRequest.id },
    TreeNodeType.Request,
  ))!;
  const secondRequestNode = (await workspacePage.findItemNode(
    { name: secondRequest.name, id: secondRequest.id },
    TreeNodeType.Request,
  ))!;
  const treeBeforeDrags = await workspacePage.getTree();
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;
  const collectionChildrenBefore = treeBeforeDrags
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children.map((c) => c._id);
  const outerFolderChildrenBefore = treeBeforeDrags
    .flatten()
    .find((n) => n._id === outerFolderNode._id)!.children.map((c) => c._id);
  await workspacePage.expand(outerFolderNode);

  await workspacePage.startDrag(firstRequestNode);
  await workspacePage.dragOver(secondRequestNode, 0.5, 0.7);
  const indicatorForRequestOntoRequest = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterFirstDrag = await workspacePage.getTree();
  const collectionChildrenAfterFirstDrag = treeAfterFirstDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children.map((c) => c._id);

  await workspacePage.startDrag(outerFolderNode);
  await workspacePage.dragOver(innerFolderNode, 0.5, 0.5);
  const indicatorForFolderOntoDescendant = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterSecondDrag = await workspacePage.getTree();
  const outerFolderChildrenAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === outerFolderNode._id)!.children.map((c) => c._id);

  expect(Boolean(indicatorForRequestOntoRequest?.isValid)).toBe(false);
  expect(collectionChildrenAfterFirstDrag).toEqual(collectionChildrenBefore);
  expect(Boolean(indicatorForFolderOntoDescendant?.isValid)).toBe(false);
  expect(outerFolderChildrenAfterSecondDrag).toEqual(
    outerFolderChildrenBefore,
  );
});
