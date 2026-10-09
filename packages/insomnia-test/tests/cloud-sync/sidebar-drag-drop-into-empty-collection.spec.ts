import { faker } from "@faker-js/faker";

import { TreeNodeType } from "../../enums/tree-node-types";
import { expect, test } from "../../misc/fixtures";
import { Collection } from "../../models/collection";

test("Verify dragging a request out of a Cloud Sync collection into an empty Cloud Sync collection", async ({
  user,
}) => {
  test.fail(true, "INS-3844");

  const { workspaceFlow, cloudSyncFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await cloudSyncFlow.fetch("My Collection R1");

  const cloudCollection = await workspaceFlow.get<Collection>(
    "My Collection R1",
  );
  const project = await workspaceFlow.getProject({ name: "Personal Workspace" });
  const emptyCollection = await workspaceFlow.create(
    project!,
    new Collection(faker.string.alphanumeric(10)),
  );

  const cloudCollectionNode = (await workspacePage.findItemNode(
    cloudCollection!,
    TreeNodeType.Workspace,
  ))!;
  const emptyCollectionNode = (await workspacePage.findItemNode(
    emptyCollection,
    TreeNodeType.Workspace,
  ))!;
  const draggedRequestNode = (await workspacePage.findItemNode(
    { name: "New Request" },
    TreeNodeType.Request,
    cloudCollectionNode,
  ))!;
  const emptyCollectionPlaceholder = {
    _id: `empty-collection-${emptyCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(draggedRequestNode);
  await workspacePage.dragOver(emptyCollectionPlaceholder, 0.5, 0.5);
  const indicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterDrag = await workspacePage.getTree();
  const cloudCollectionChildrenAfter = treeAfterDrag
    .flatten()
    .find((n) => n._id === cloudCollectionNode._id)!.children;
  const emptyCollectionChildrenAfter = treeAfterDrag
    .flatten()
    .find((n) => n._id === emptyCollectionNode._id)!.children;

  expect(indicator?.isValid).toBe(true);
  expect(
    cloudCollectionChildrenAfter.some((n) => n._id === draggedRequestNode._id),
  ).toBe(false);
  expect(
    emptyCollectionChildrenAfter.some((n) => n._id === draggedRequestNode._id),
  ).toBe(true);
});
