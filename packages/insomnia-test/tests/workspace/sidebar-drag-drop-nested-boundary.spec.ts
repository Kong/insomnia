import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

const SCAN_OFFSETS_PX = [1, 5, 10, 20, 30, 45, 65, 90, 120, 160, 210, 270, 340];

test("Verify the drop indicator's depth and the actual landing spot agree at a nested folder boundary", async ({
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
  const afterBoundary = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const outerFolder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const innerFolder = await folderFlow.create(
    outerFolder,
    new Folder(faker.string.alphanumeric(10)),
  );
  const lastChild = await httpRequestFlow.create(
    innerFolder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );

  const outerFolderNode = (await workspacePage.findItemNode(
    { name: outerFolder.name, id: outerFolder.id },
    TreeNodeType.Folder,
  ))!;
  const innerFolderNode = (await workspacePage.findItemNode(
    { name: innerFolder.name, id: innerFolder.id },
    TreeNodeType.Folder,
    outerFolderNode,
  ))!;
  const lastChildNode = (await workspacePage.findItemNode(
    { name: lastChild.name, id: lastChild.id },
    TreeNodeType.Request,
    innerFolderNode,
  ))!;
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;

  const shallowDragItem = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const shallowDragItemNode = (await workspacePage.findItemNode(
    { name: shallowDragItem.name, id: shallowDragItem.id },
    TreeNodeType.Request,
  ))!;

  await workspacePage.startDrag(shallowDragItemNode);
  const scanResults: { px: number; folderName: string | null; isValid: boolean }[] = [];
  for (const px of SCAN_OFFSETS_PX) {
    await workspacePage.dragOverPixels(lastChildNode, px, 0.9);
    const indicator = await workspacePage.getDropIndicator();
    scanResults.push({
      px,
      folderName: indicator?.folderName ?? null,
      isValid: indicator?.isValid ?? false,
    });
  }
  const shallowScan = scanResults.find(
    (r) => r.isValid && r.folderName === null,
  );
  const deepScan = scanResults.find(
    (r) => r.isValid && r.folderName === innerFolder.name,
  );
  await workspacePage.dragOverPixels(lastChildNode, shallowScan!.px, 0.9);
  await workspacePage.releaseDrag();
  await user.page.waitForTimeout(300);

  const treeAfterShallowDrop = await workspacePage.getTree();
  const collectionChildrenAfterShallowDrop = treeAfterShallowDrop
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;
  const outerFolderAfterShallowDrop = treeAfterShallowDrop
    .flatten()
    .find((n) => n._id === outerFolderNode._id)!;

  const deepDragItem = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const deepDragItemNode = (await workspacePage.findItemNode(
    { name: deepDragItem.name, id: deepDragItem.id },
    TreeNodeType.Request,
  ))!;
  await workspacePage.startDrag(deepDragItemNode);
  await workspacePage.dragOverPixels(lastChildNode, deepScan!.px, 0.9);
  await workspacePage.releaseDrag();
  await user.page.waitForTimeout(300);

  const treeAfterDeepDrop = await workspacePage.getTree();
  const outerFolderAfterDeepDrop = treeAfterDeepDrop
    .flatten()
    .find((n) => n._id === outerFolderNode._id)!;
  const innerFolderAfterDeepDrop = treeAfterDeepDrop
    .flatten()
    .find((n) => n._id === innerFolderNode._id)!;

  expect(shallowScan).toBeDefined();
  expect(deepScan).toBeDefined();
  const outerFolderIndex = collectionChildrenAfterShallowDrop.findIndex(
    (n) => n._id === outerFolderNode._id,
  );
  expect(collectionChildrenAfterShallowDrop[outerFolderIndex + 1]?._id).toBe(
    shallowDragItemNode._id,
  );
  expect(
    outerFolderAfterShallowDrop.children.some(
      (c) => c._id === shallowDragItemNode._id,
    ),
  ).toBe(false);
  expect(
    innerFolderAfterDeepDrop.children.some(
      (c) => c._id === deepDragItemNode._id,
    ),
  ).toBe(true);
  expect(
    outerFolderAfterDeepDrop.children.some(
      (c) => c._id === deepDragItemNode._id,
    ),
  ).toBe(false);
});
