import { faker } from "@faker-js/faker";

import { HttpMethod } from "../../enums/http-method";
import { ProjectType } from "../../enums/project-types";
import { TreeNodeType } from "../../enums/tree-node-types";
import { HTTP_SERVER } from "../../misc/fixtures";
import { expect, GIT_CREDENTIAL, test } from "../../misc/git-fixtures";
import { Collection } from "../../models/collection";
import { Project } from "../../models/project";

test("Verify dragging a request between a Cloud project and a Git project moves it in both directions", async ({
  user,
}) => {
  test.fail(true, "INS-3844");

  const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
  const { workspacePage } = user.pageManager;

  await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
  const gitProject = await workspaceFlow.create(
    new Project(faker.string.alphanumeric(10), ProjectType.Git),
    GIT_CREDENTIAL.name,
  );
  const gitCollection = await workspaceFlow.create(
    gitProject,
    new Collection(faker.string.alphanumeric(10)),
    faker.string.alphanumeric(10),
  );
  const cloudProject = (await workspaceFlow.getProject({
    name: "Personal Workspace",
  }))!;
  const cloudCollection = await workspaceFlow.create(
    cloudProject,
    new Collection(faker.string.alphanumeric(10)),
  );
  const request = await httpRequestFlow.create(gitCollection, {
    name: faker.string.alphanumeric(10),
    method: HttpMethod.Get,
    url: `${HTTP_SERVER}/get`,
  });

  const gitProjectNode = (await workspacePage.findItemNode(
    gitProject,
    TreeNodeType.Project,
  ))!;
  const cloudProjectNode = (await workspacePage.findItemNode(
    cloudProject,
    TreeNodeType.Project,
  ))!;
  await workspacePage.expand(gitProjectNode);
  await workspacePage.expand(cloudProjectNode);
  const gitCollectionNode = (await workspacePage.findItemNode(
    gitCollection,
    TreeNodeType.Workspace,
  ))!;
  const cloudCollectionNode = (await workspacePage.findItemNode(
    cloudCollection,
    TreeNodeType.Workspace,
  ))!;
  const requestNode = (await workspacePage.findItemNode(
    { name: request.name, id: request.id },
    TreeNodeType.Request,
    gitCollectionNode,
  ))!;
  const emptyCloudCollectionPlaceholder = {
    _id: `empty-collection-${cloudCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyCloudCollectionPlaceholder, 0.5, 0.5);
  const gitToCloudIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterGitToCloud = await workspacePage.getTree();
  const gitCollectionChildrenAfterMove = treeAfterGitToCloud
    .flatten()
    .find((n) => n._id === gitCollectionNode._id)!.children;
  const cloudCollectionChildrenAfterMove = treeAfterGitToCloud
    .flatten()
    .find((n) => n._id === cloudCollectionNode._id)!.children;
  const emptyGitCollectionPlaceholder = {
    _id: `empty-collection-${gitCollection.id}`,
    name: "",
    type: TreeNodeType.Unknown,
    children: [],
  };

  await workspacePage.startDrag(requestNode);
  await workspacePage.dragOver(emptyGitCollectionPlaceholder, 0.5, 0.5);
  const cloudToGitIndicator = await workspacePage.getDropIndicator();
  await workspacePage.releaseDrag();
  const treeAfterCloudToGit = await workspacePage.getTree();
  const cloudCollectionChildrenAfterMoveBack = treeAfterCloudToGit
    .flatten()
    .find((n) => n._id === cloudCollectionNode._id)!.children;
  const gitCollectionChildrenAfterMoveBack = treeAfterCloudToGit
    .flatten()
    .find((n) => n._id === gitCollectionNode._id)!.children;

  expect(gitToCloudIndicator?.isValid).toBe(true);
  expect(
    gitCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    cloudCollectionChildrenAfterMove.some((n) => n._id === requestNode._id),
  ).toBe(true);
  expect(cloudToGitIndicator?.isValid).toBe(true);
  expect(
    cloudCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(false);
  expect(
    gitCollectionChildrenAfterMoveBack.some((n) => n._id === requestNode._id),
  ).toBe(true);
});
