import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { HTTP_SERVER } from "../../misc/fixtures";
import { expect, GIT_CREDENTIAL, test } from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify dragging a request between a Local project and a Git project moves it in both directions", async ({
  user,
}) => {
  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const localProject = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Local),
  );
  const localCollection = await workspaceFlow.create(
    localProject,
    new Collection(faker.string.alphanumeric(10)),
  );
  const gitProject = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const gitCollection = await workspaceFlow.create(
    gitProject,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
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
  const gitProjectNode = (await workspacePage.findItemNode(
    gitProject,
    TreeNodeType.Project,
  ))!;
  await workspacePage.expand(localProjectNode);
  await workspacePage.expand(gitProjectNode);
  const localCollectionNode = (await workspacePage.findItemNode(
    localCollection,
    TreeNodeType.Workspace,
  ))!;
  const gitCollectionNode = (await workspacePage.findItemNode(
    gitCollection,
    TreeNodeType.Workspace,
  ))!;
  const requestNode = (await workspacePage.findItemNode(
    { name: request.name, id: request.id },
    TreeNodeType.Request,
    localCollectionNode,
  ))!;
  const emptyGitCollectionPlaceholder = {
    _id: `empty-collection-${gitCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyGitCollectionPlaceholder, 0.5, 0.5);
  const localToGitIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterLocalToGit = await workspacePage.getTree();
  const localCollectionChildrenAfterMove = treeAfterLocalToGit
    .flatten()
    .find((n) => n._id === localCollectionNode._id)!.children;
  const gitCollectionChildrenAfterMove = treeAfterLocalToGit
    .flatten()
    .find((n) => n._id === gitCollectionNode._id)!.children;
  const emptyLocalCollectionPlaceholder = {
    _id: `empty-collection-${localCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyLocalCollectionPlaceholder, 0.5, 0.5);
  const gitToLocalIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterGitToLocal = await workspacePage.getTree();
  const localCollectionChildrenAfterMoveBack = treeAfterGitToLocal
    .flatten()
    .find((n) => n._id === localCollectionNode._id)!.children;
  const gitCollectionChildrenAfterMoveBack = treeAfterGitToLocal
    .flatten()
    .find((n) => n._id === gitCollectionNode._id)!.children;

  expect(localToGitIndicator?.isValid).toBe(true);
  expect(
    localCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    gitCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(true);
  expect(gitToLocalIndicator?.isValid).toBe(true);
  expect(
    gitCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    localCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(true);
});
