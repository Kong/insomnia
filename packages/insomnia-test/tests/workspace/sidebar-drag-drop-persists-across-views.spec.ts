import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify sidebar reorder behaves unchanged and persists across views when switching between the spec and request views", async ({
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
  const folder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const folderChild = await httpRequestFlow.create(folder, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const sibling = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const folderNode = (await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
  ))!;
  const siblingNode = (await workspacePage.findItemNode(
    { name: sibling.name, id: sibling.id },
    TreeNodeType.Request,
  ))!;
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;

  await workspacePage.dragAndDrop(siblingNode, folderNode, 0.05, 0.95);
  const treeAfterDrag = await workspacePage.getTree();
  const collectionChildrenAfterDrag = treeAfterDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;
  const folderAfterDrag = treeAfterDrag
    .flatten()
    .find((n) => n._id === folderNode._id)!;
  const folderIndex = collectionChildrenAfterDrag.findIndex(
    (n) => n._id === folderNode._id,
  );

  await workspacePage.clickNode(collectionNode);
  await workspacePage.navigateSpec();
  await httpRequestFlow.get(folderChild.name);
  const treeAfterViewSwitch = await workspacePage.getTree();
  const collectionChildrenAfterViewSwitch = treeAfterViewSwitch
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;

  expect(collectionChildrenAfterDrag[folderIndex + 1]?._id).toBe(
    siblingNode._id,
  );
  expect(folderAfterDrag.children.map((c) => c._id)).toEqual([
    folderChild.id,
  ]);
  expect(collectionChildrenAfterViewSwitch.map((n) => n._id)).toEqual(
    collectionChildrenAfterDrag.map((n) => n._id),
  );
});
