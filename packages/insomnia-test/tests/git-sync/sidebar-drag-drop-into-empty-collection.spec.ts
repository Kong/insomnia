import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { HTTP_SERVER } from "../../misc/fixtures";
import { expect, GIT_CREDENTIAL, test } from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify dragging a request out of a Git Sync collection into an empty Git Sync collection", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const project = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const sourceCollection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );
  const emptyCollection = await workspaceFlow.create(
    project,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );
  const draggedRequest = await httpRequestFlow.create(sourceCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const sourceCollectionNode = (await workspacePage.findItemNode(
    sourceCollection,
    TreeNodeType.Workspace,
  ))!;
  const emptyCollectionNode = (await workspacePage.findItemNode(
    emptyCollection,
    TreeNodeType.Workspace,
  ))!;
  const draggedRequestNode = (await workspacePage.findItemNode(
    { name: draggedRequest.name, id: draggedRequest.id },
    TreeNodeType.Request,
    sourceCollectionNode,
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
  const sourceCollectionChildrenAfter = treeAfterDrag
    .flatten()
    .find((n) => n._id === sourceCollectionNode._id)!.children;
  const emptyCollectionChildrenAfter = treeAfterDrag
    .flatten()
    .find((n) => n._id === emptyCollectionNode._id)!.children;

  expect(indicator?.isValid).toBe(true);
  expect(
    sourceCollectionChildrenAfter.some((n) => n._id === draggedRequestNode._id),
  ).toBe(false);
  expect(
    emptyCollectionChildrenAfter.some((n) => n._id === draggedRequestNode._id),
  ).toBe(true);
});
