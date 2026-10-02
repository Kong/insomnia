import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

test("Verify dragging an item beside a folder does not land it inside the folder", async ({
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
  const folderChild1 = await httpRequestFlow.create(
    folder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );
  const folderChild2 = await httpRequestFlow.create(
    folder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );
  const sibling = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const folderNode = (await workspacePage.findItemNode(
    { name: folder.name, id: folder.id },
    TreeNodeType.Folder,
  ))!;
  const folderChild2Node = (await workspacePage.findItemNode(
    { name: folderChild2.name, id: folderChild2.id },
    TreeNodeType.Request,
    folderNode,
  ))!;
  const siblingNode = (await workspacePage.findItemNode(
    { name: sibling.name, id: sibling.id },
    TreeNodeType.Request,
  ))!;
  const wasExpandedBefore = await workspacePage.isExpanded(folderNode);

  await workspacePage.dragAndDrop(siblingNode, folderNode, 0.05, 0.95);
  const treeAfterFirstDrag = await workspacePage.getTree();
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;
  const collectionChildrenAfterFirstDrag = treeAfterFirstDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;
  const folderAfterFirstDrag = treeAfterFirstDrag
    .flatten()
    .find((n) => n._id === folderNode._id)!;

  await workspacePage.dragAndDrop(folderChild2Node, folderNode, 0.05, 0.05);
  const treeAfterSecondDrag = await workspacePage.getTree();
  const collectionChildrenAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;
  const folderAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === folderNode._id)!;
  const wasExpandedAfter = await workspacePage.isExpanded(folderNode);

  const folderIndex = collectionChildrenAfterFirstDrag.findIndex(
    (n) => n._id === folderNode._id,
  );
  expect(collectionChildrenAfterFirstDrag[folderIndex + 1]?._id).toBe(
    siblingNode._id,
  );
  expect(folderAfterFirstDrag.children.map((c) => c._id)).toEqual([
    folderChild2.id,
    folderChild1.id,
  ]);
  expect(wasExpandedAfter).toBe(wasExpandedBefore);
  expect(
    folderAfterSecondDrag.children.some((c) => c._id === folderChild2.id),
  ).toBe(false);
  expect(folderAfterSecondDrag.children.map((c) => c._id)).toEqual([
    folderChild1.id,
  ]);
  expect(
    collectionChildrenAfterSecondDrag.some((n) => n._id === folderChild2.id),
  ).toBe(true);
});
