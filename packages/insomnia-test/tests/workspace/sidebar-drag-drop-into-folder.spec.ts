import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER,test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Folder } from "../../models/folder";
import { Project } from "../../models/project";

const WINDOW_WIDTH = 1512;
const WINDOW_HEIGHT = 859;

test("Verify dragging an item into a folder via its name region reparents it", async ({
  user,
  insomnia,
}) => {
  const { workspaceFlow, folderFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await insomnia.evaluate(
    ({ BrowserWindow }, { width, height }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((w) =>
        w.isVisible(),
      );
      mainWindow?.unmaximize();
      mainWindow?.setSize(width, height);
    },
    { width: WINDOW_WIDTH, height: WINDOW_HEIGHT },
  );

  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const collection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
  );
  const destinationFolder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const standaloneRequest = await httpRequestFlow.create(collection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });
  const populatedFolder = await folderFlow.create(
    collection,
    new Folder(faker.string.alphanumeric(10)),
  );
  const populatedFolderChild1 = await httpRequestFlow.create(
    populatedFolder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );
  const populatedFolderChild2 = await httpRequestFlow.create(
    populatedFolder,
    {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    },
  );

  const destinationFolderNode = (await workspacePage.findItemNode(
    { name: destinationFolder.name, id: destinationFolder.id },
    TreeNodeType.Folder,
  ))!;
  const standaloneRequestNode = (await workspacePage.findItemNode(
    { name: standaloneRequest.name, id: standaloneRequest.id },
    TreeNodeType.Request,
  ))!;
  const populatedFolderNode = (await workspacePage.findItemNode(
    { name: populatedFolder.name, id: populatedFolder.id },
    TreeNodeType.Folder,
  ))!;
  const populatedFolderChildrenBefore = populatedFolderNode.children.map(
    (c) => c._id,
  );

  await workspacePage.startDrag(standaloneRequestNode);
  await workspacePage.dragOver(destinationFolderNode, 0.7, 0.95);
  const indicatorForStandaloneRequest = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  await workspacePage.expand(destinationFolderNode);
  const treeAfterFirstDrag = await workspacePage.getTree();
  const destinationFolderAfterFirstDrag = treeAfterFirstDrag
    .flatten()
    .find((n) => n._id === destinationFolderNode._id)!;

  await workspacePage.startDrag(populatedFolderNode);
  await workspacePage.dragOver(destinationFolderNode, 0.7, 0.95);
  const indicatorForPopulatedFolder = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  await workspacePage.expand(destinationFolderNode);
  const treeAfterSecondDrag = await workspacePage.getTree();
  const destinationFolderAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === destinationFolderNode._id)!;
  const populatedFolderAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === populatedFolderNode._id)!;
  const collectionNode = (await workspacePage.findItemNode(
    collection,
    TreeNodeType.Workspace,
  ))!;
  const collectionChildrenAfterSecondDrag = treeAfterSecondDrag
    .flatten()
    .find((n) => n._id === collectionNode._id)!.children;

  const populatedFolderChild1Node = (await workspacePage.findItemNode(
    { name: populatedFolderChild1.name, id: populatedFolderChild1.id },
    TreeNodeType.Request,
  ))!;

  await workspacePage.clickNode(standaloneRequestNode);
  const breadcrumbForStandaloneRequest =
    await workspacePage.waitForBreadcrumbSettled([
      project.name,
      collection.name,
      destinationFolder.name,
      standaloneRequest.name,
    ]);
  await workspacePage.clickNode(populatedFolderChild1Node);
  const breadcrumbForPopulatedFolderChild =
    await workspacePage.waitForBreadcrumbSettled([
      project.name,
      collection.name,
      "...",
      populatedFolderChild1.name,
    ]);

  expect(indicatorForStandaloneRequest?.isValid).toBe(true);
  expect(indicatorForStandaloneRequest?.folderName).toBe(
    destinationFolder.name,
  );
  expect(
    destinationFolderAfterFirstDrag.children.some(
      (c) => c._id === standaloneRequestNode._id,
    ),
  ).toBe(true);
  expect(indicatorForPopulatedFolder?.isValid).toBe(true);
  expect(indicatorForPopulatedFolder?.folderName).toBe(
    destinationFolder.name,
  );
  expect(
    destinationFolderAfterSecondDrag.children.some(
      (c) => c._id === populatedFolderNode._id,
    ),
  ).toBe(true);
  expect(populatedFolderAfterSecondDrag.children.map((c) => c._id)).toEqual(
    populatedFolderChildrenBefore,
  );
  expect(populatedFolderAfterSecondDrag.children.map((c) => c._id)).toEqual([
    populatedFolderChild2.id,
    populatedFolderChild1.id,
  ]);
  expect(
    collectionChildrenAfterSecondDrag.some(
      (n) => n._id === populatedFolderChild1.id || n._id === populatedFolderChild2.id,
    ),
  ).toBe(false);
  expect(breadcrumbForStandaloneRequest).toEqual([
    project.name,
    collection.name,
    destinationFolder.name,
    standaloneRequest.name,
  ]);
  expect(breadcrumbForPopulatedFolderChild).toEqual([
    project.name,
    collection.name,
    "...",
    populatedFolderChild1.name,
  ]);
});
