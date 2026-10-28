import { faker } from '@faker-js/faker';

import { HttpMethod } from '../../enums/http-method';
import { ProjectType } from '../../enums/project-types';
import { TreeNodeType } from '../../enums/tree-node-types';
import { expect, HTTP_SERVER, test } from '../../misc/fixtures';
import { Collection } from '../../models/collection';
import { Project } from '../../models/project';

test(
  'Verify dragging a request between a Cloud project and a Local project is rejected in both directions',
  async ({ user }) => {
    const { workspaceFlow, httpRequestFlow } = user.flowManager;
    const { workspacePage } = user.pageManager;

    const localProject = await workspaceFlow.create(new Project(faker.string.alphanumeric(10), ProjectType.Local));
    const localSource = await workspaceFlow.create(localProject, new Collection(faker.string.alphanumeric(10)));
    const localTarget = await workspaceFlow.create(localProject, new Collection(faker.string.alphanumeric(10)));
    const cloudProject = (await workspaceFlow.getProject({
      name: 'Personal Workspace',
    }))!;
    const cloudSource = await workspaceFlow.create(cloudProject, new Collection(faker.string.alphanumeric(10)));
    const cloudTarget = await workspaceFlow.create(cloudProject, new Collection(faker.string.alphanumeric(10)));
    const localRequest = await httpRequestFlow.create(localSource, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    });
    const cloudRequest = await httpRequestFlow.create(cloudSource, {
      name: faker.string.alphanumeric(10),
      method: HttpMethod.Get,
      url: `${HTTP_SERVER}/get`,
    });

    const localProjectNode = (await workspacePage.findItemNode(localProject, TreeNodeType.Project))!;
    const cloudProjectNode = (await workspacePage.findItemNode(cloudProject, TreeNodeType.Project))!;
    await workspacePage.expand(localProjectNode);
    await workspacePage.expand(cloudProjectNode);
    const localSourceNode = (await workspacePage.findItemNode(localSource, TreeNodeType.Workspace))!;
    const localTargetNode = (await workspacePage.findItemNode(localTarget, TreeNodeType.Workspace))!;
    const cloudSourceNode = (await workspacePage.findItemNode(cloudSource, TreeNodeType.Workspace))!;
    const cloudTargetNode = (await workspacePage.findItemNode(cloudTarget, TreeNodeType.Workspace))!;
    const localRequestNode = (await workspacePage.findItemNode(
      { name: localRequest.name, id: localRequest.id },
      TreeNodeType.Request,
      localSourceNode,
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
    const emptyLocalTargetPlaceholder = {
      _id: `empty-collection-${localTarget.id}`,
      name: '',
      type: TreeNodeType.Unknown,
      children: [],
    };

    await workspacePage.startDrag(localRequestNode);
    await workspacePage.dragOver(emptyCloudTargetPlaceholder, 0.5, 0.5);
    const localToCloudIndicator = await workspacePage.getDropIndicator();
    await workspacePage.releaseDrag();
    const treeAfterLocalToCloud = await workspacePage.getTree();
    const localSourceChildrenAfterReject = treeAfterLocalToCloud
      .flatten()
      .find(n => n._id === localSourceNode._id)!.children;
    const cloudTargetChildrenAfterReject = treeAfterLocalToCloud
      .flatten()
      .find(n => n._id === cloudTargetNode._id)!.children;

    await workspacePage.startDrag(cloudRequestNode);
    await workspacePage.dragOver(emptyLocalTargetPlaceholder, 0.5, 0.5);
    const cloudToLocalIndicator = await workspacePage.getDropIndicator();
    await workspacePage.releaseDrag();
    const treeAfterCloudToLocal = await workspacePage.getTree();
    const cloudSourceChildrenAfterReject = treeAfterCloudToLocal
      .flatten()
      .find(n => n._id === cloudSourceNode._id)!.children;
    const localTargetChildrenAfterReject = treeAfterCloudToLocal
      .flatten()
      .find(n => n._id === localTargetNode._id)!.children;

    expect(localToCloudIndicator?.isValid).toBe(false);
    expect(localSourceChildrenAfterReject.some(n => n._id === localRequestNode._id)).toBe(true);
    expect(cloudTargetChildrenAfterReject.some(n => n._id === localRequestNode._id)).toBe(false);
    expect(cloudToLocalIndicator?.isValid).toBe(false);
    expect(cloudSourceChildrenAfterReject.some(n => n._id === cloudRequestNode._id)).toBe(true);
    expect(localTargetChildrenAfterReject.some(n => n._id === cloudRequestNode._id)).toBe(false);
  },
);
