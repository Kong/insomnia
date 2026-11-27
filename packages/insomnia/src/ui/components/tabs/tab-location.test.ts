import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '../../../common/database';
import type { BaseTab } from '../../context/app/insomnia-tab-context';
import { buildTabLocationUpdates, getRouteTabLocationUpdate } from './tab-location';

const makeTab = (overrides: Partial<BaseTab> = {}): BaseTab => ({
  type: 'request',
  name: 'Get Widgets',
  url: '/organization/org_1/project/proj_a/workspace/wrk_1/debug/request/req_1',
  organizationId: 'org_1',
  projectId: 'proj_a',
  workspaceId: 'wrk_1',
  projectName: 'Project A',
  workspaceName: 'Collection 1',
  id: 'req_1',
  ...overrides,
});

describe('buildTabLocationUpdates', () => {
  it('points a tab at its new project and workspace', () => {
    expect(
      buildTabLocationUpdates([makeTab()], {
        projectId: 'proj_b',
        projectName: 'Project B',
        workspaceId: 'wrk_2',
        workspaceName: 'Collection 2',
      }),
    ).toEqual([
      {
        id: 'req_1',
        fields: {
          projectId: 'proj_b',
          projectName: 'Project B',
          workspaceId: 'wrk_2',
          workspaceName: 'Collection 2',
          url: '/organization/org_1/project/proj_b/workspace/wrk_2/debug/request/req_1',
        },
      },
    ]);
  });

  it('skips tabs that are already at the location (e.g. a reorder within the same parent)', () => {
    expect(
      buildTabLocationUpdates([makeTab()], {
        projectId: 'proj_a',
        projectName: 'Project A',
        workspaceId: 'wrk_1',
        workspaceName: 'Collection 1',
      }),
    ).toEqual([]);
  });
});

describe('getRouteTabLocationUpdate', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  const createCollection = async (projectId: string) =>
    services.workspace.create({ name: 'Collection', parentId: projectId, scope: 'collection' });

  it('persists the route location when the route is where the resource lives', async () => {
    const project = await services.project.create({ name: 'Project B' });
    const workspace = await createCollection(project._id);
    const request = await services.request.create({ name: 'Request', parentId: workspace._id });

    const update = await getRouteTabLocationUpdate(makeTab({ id: request._id }), {
      project,
      workspace,
      resource: request,
    });

    expect(update?.fields).toMatchObject({ projectId: project._id, workspaceId: workspace._id });
  });

  it('leaves the tab alone when the route sits on a workspace that no longer holds the resource', async () => {
    const project = await services.project.create({ name: 'Project' });
    const staleWorkspace = await createCollection(project._id);
    const currentWorkspace = await createCollection(project._id);
    const folder = await services.requestGroup.create({ name: 'Folder', parentId: currentWorkspace._id });
    const runnerTab = makeTab({
      type: 'runner',
      id: `runner_${folder._id}`,
      projectId: project._id,
      workspaceId: currentWorkspace._id,
    });

    expect(
      await getRouteTabLocationUpdate(runnerTab, { project, workspace: staleWorkspace, resource: folder }),
    ).toBeNull();
  });
});
