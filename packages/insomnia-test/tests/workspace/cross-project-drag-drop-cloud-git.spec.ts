import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { TreeNodeType } from '../../enums/tree-node-types';
import { HTTP_SERVER } from '../../misc/fixtures';
import { expect, GIT_CREDENTIAL, test } from '../../misc/git-fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test(
  'Verify dragging a request between a Cloud project and a Git project is rejected in both directions',
  async ({ user }) => {
    const { workspaceFlow, httpRequestFlow, preferencesFlow } = user.flowManager;
    const { workspacePage } = user.pageManager;

    await preferencesFlow.addGitCredential(GIT_CREDENTIAL);
    const gitProject = await workspaceFlow.create(
      new Project(faker.string.alphanumeric(10), ProjectType.Git),
      GIT_CREDENTIAL.name,
    );
    const gitSource = await workspaceFlow.create(
      gitProject,
      new Collection(faker.string.alphanumeric(10)),
      faker.string.alphanumeric(10),
    );
    const gitTarget = await workspaceFlow.create(
      gitProject,
      new Collection(faker.string.alphanumeric(10)),
      faker.string.alphanumeric(10),
    );
    const cloudProject = (await workspaceFlow.getProject({
      name: 'Personal Workspace',
    }))!;
    const cloudSource = await workspaceFlow.create(cloudProject, new Collection(faker.string.alphanumeric(10)));
    const cloudTarget = await workspaceFlow.create(cloudProject, new Collection(faker.string.alphanumeric(10)));
    const gitRequest = await httpRequestFlow.create(gitSource, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    });
    const cloudRequest = await httpRequestFlow.create(cloudSource, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    });

    const gitProjectNode = (await workspacePage.findItemNode(gitProject, TreeNodeType.Project))!;
    const cloudProjectNode = (await workspacePage.findItemNode(cloudProject, TreeNodeType.Project))!;
    await workspacePage.expand(gitProjectNode);
    await workspacePage.expand(cloudProjectNode);
    const gitSourceNode = (await workspacePage.findItemNode(gitSource, TreeNodeType.Workspace))!;
    const gitTargetNode = (await workspacePage.findItemNode(gitTarget, TreeNodeType.Workspace))!;
    const cloudSourceNode = (await workspacePage.findItemNode(cloudSource, TreeNodeType.Workspace))!;
    const cloudTargetNode = (await workspacePage.findItemNode(cloudTarget, TreeNodeType.Workspace))!;
    const gitRequestNode = (await workspacePage.findItemNode(
      { name: gitRequest.name, id: gitRequest.id },
      TreeNodeType.Request,
      gitSourceNode,
    ))!;
    const cloudRequestNode = (await workspacePage.findItemNode(
      { name: cloudRequest.name, id: cloudRequest.id },
      TreeNodeType.Request,
      cloudSourceNode,
    ))!;
    const emptyCloudTargetPlaceholder = {
      _id: `empty-collection-${cloudTarget.id}`,
      name: '',
      type: TreeNodeType.Unknown,
      children: [],
    };
    const emptyGitTargetPlaceholder = {
      _id: `empty-collection-${gitTarget.id}`,
      name: '',
      type: TreeNodeType.Unknown,
      children: [],
    };

    await workspacePage.startDrag(gitRequestNode);
    await workspacePage.dragOver(emptyCloudTargetPlaceholder, 0.5, 0.5);
    const gitToCloudIndicator = await workspacePage.getDropIndicator();
    await workspacePage.releaseDrag();
    const treeAfterGitToCloud = await workspacePage.getTree();
    const gitSourceChildrenAfterReject = treeAfterGitToCloud
      .flatten()
      .find(n => n._id === gitSourceNode._id)!.children;
    const cloudTargetChildrenAfterReject = treeAfterGitToCloud
      .flatten()
      .find(n => n._id === cloudTargetNode._id)!.children;

    await workspacePage.startDrag(cloudRequestNode);
    await workspacePage.dragOver(emptyGitTargetPlaceholder, 0.5, 0.5);
    const cloudToGitIndicator = await workspacePage.getDropIndicator();
    await workspacePage.releaseDrag();
    const treeAfterCloudToGit = await workspacePage.getTree();
    const cloudSourceChildrenAfterReject = treeAfterCloudToGit
      .flatten()
      .find(n => n._id === cloudSourceNode._id)!.children;
    const gitTargetChildrenAfterReject = treeAfterCloudToGit
      .flatten()
      .find(n => n._id === gitTargetNode._id)!.children;

    expect(gitToCloudIndicator?.isValid).toBe(false);
    expect(gitSourceChildrenAfterReject.some(n => n._id === gitRequestNode._id)).toBe(true);
    expect(cloudTargetChildrenAfterReject.some(n => n._id === gitRequestNode._id)).toBe(false);
    expect(cloudToGitIndicator?.isValid).toBe(false);
    expect(cloudSourceChildrenAfterReject.some(n => n._id === cloudRequestNode._id)).toBe(true);
    expect(gitTargetChildrenAfterReject.some(n => n._id === cloudRequestNode._id)).toBe(false);
  },
);
