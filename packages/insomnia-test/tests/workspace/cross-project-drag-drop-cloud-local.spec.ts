import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, HTTP_SERVER, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify dragging a request between a Cloud project and a Local project moves it in both directions", async ({
  user,
}) => {
  test.fail(true, "INS-3844");

  const { workspaceFlow, httpRequestFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  const localProject = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const localCollection = await workspaceFlow.create(
    localProject,
    new Collection(faker.string.alphanumeric(10)),
  );
  const cloudProject = (await workspaceFlow.getProject({
    name: "Personal Workspace",
  }))!;
  const cloudCollection = await workspaceFlow.create(
    cloudProject,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(localCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const localProjectNode = (await workspacePage.findItemNode(
    localProject,
    TreeNodeType.Project,
  ))!;
  const cloudProjectNode = (await workspacePage.findItemNode(
    cloudProject,
    TreeNodeType.Project,
  ))!;
  await workspacePage.expand(localProjectNode);
  await workspacePage.expand(cloudProjectNode);
  const localCollectionNode = (await workspacePage.findItemNode(
    localCollection,
    TreeNodeType.Workspace,
  ))!;
  const cloudCollectionNode = (await workspacePage.findItemNode(
    cloudCollection,
    TreeNodeType.Workspace,
  ))!;
  const requestNode = (await workspacePage.findItemNode(
    { name: request.name, id: request.id },
    TreeNodeType.Request,
    localCollectionNode,
  ))!;
  const emptyCloudCollectionPlaceholder = {
    _id: `empty-collection-${cloudCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyCloudCollectionPlaceholder, 0.5, 0.5);
  const localToCloudIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterLocalToCloud = await workspacePage.getTree();
  const localCollectionChildrenAfterMove = treeAfterLocalToCloud
    .flatten()
    .find((n) => n._id === localCollectionNode._id)!.children;
  const cloudCollectionChildrenAfterMove = treeAfterLocalToCloud
    .flatten()
    .find((n) => n._id === cloudCollectionNode._id)!.children;
  const emptyLocalCollectionPlaceholder = {
    _id: `empty-collection-${localCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyLocalCollectionPlaceholder, 0.5, 0.5);
  const cloudToLocalIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterCloudToLocal = await workspacePage.getTree();
  const cloudCollectionChildrenAfterMoveBack = treeAfterCloudToLocal
    .flatten()
    .find((n) => n._id === cloudCollectionNode._id)!.children;
  const localCollectionChildrenAfterMoveBack = treeAfterCloudToLocal
    .flatten()
    .find((n) => n._id === localCollectionNode._id)!.children;

  expect(localToCloudIndicator?.isValid).toBe(true);
  expect(
    localCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    cloudCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(true);
  expect(cloudToLocalIndicator?.isValid).toBe(true);
  expect(
    cloudCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    localCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(true);
});
