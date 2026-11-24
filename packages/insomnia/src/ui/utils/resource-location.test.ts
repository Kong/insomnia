import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';

import { database as db } from '../../common/database';
import { redirectIfResourceMoved, resolveResourceLocation, rewriteWorkspaceUrl } from './resource-location';

describe('rewriteWorkspaceUrl', () => {
  const location = { projectId: 'proj_new', workspaceId: 'wrk_new' };

  it('replaces the project and workspace segments and keeps the rest of the path', () => {
    expect(
      rewriteWorkspaceUrl('/organization/org_1/project/proj_old/workspace/wrk_old/debug/request/req_1', location),
    ).toBe('/organization/org_1/project/proj_new/workspace/wrk_new/debug/request/req_1');
  });

  it('keeps the query string', () => {
    expect(
      rewriteWorkspaceUrl('/organization/org_1/project/proj_old/workspace/wrk_old/debug/runner?folder=fld_1', location),
    ).toBe('/organization/org_1/project/proj_new/workspace/wrk_new/debug/runner?folder=fld_1');
  });
});

describe('resource location from the database', () => {
  let projectId: string;
  let workspaceId: string;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
    const project = await services.project.create({ name: 'Project' });
    const workspace = await services.workspace.create({
      name: 'Collection',
      parentId: project._id,
      scope: 'collection',
    });
    projectId = project._id;
    workspaceId = workspace._id;
  });

  describe('resolveResourceLocation', () => {
    it('resolves a workspace to its project', async () => {
      const workspace = await services.workspace.getById(workspaceId);
      expect(await resolveResourceLocation(workspace!)).toEqual({ projectId, workspaceId });
    });

    it('resolves a request nested in folders to its workspace and project', async () => {
      const outer = await services.requestGroup.create({ name: 'Outer', parentId: workspaceId });
      const inner = await services.requestGroup.create({ name: 'Inner', parentId: outer._id });
      const request = await services.request.create({ name: 'Request', parentId: inner._id });
      expect(await resolveResourceLocation(request)).toEqual({ projectId, workspaceId });
      expect(await resolveResourceLocation(inner)).toEqual({ projectId, workspaceId });
    });

    it('returns null when the parent chain does not reach a workspace', async () => {
      const request = await services.request.create({ name: 'Orphan', parentId: 'fld_missing' });
      expect(await resolveResourceLocation(request)).toBeNull();
    });
  });

  describe('redirectIfResourceMoved', () => {
    const requestFor = (path: string) => new Request(`http://localhost${path}`);

    it('does nothing when the URL matches where the resource lives', async () => {
      const request = await services.request.create({ name: 'Request', parentId: workspaceId });
      const path = `/organization/org_1/project/${projectId}/workspace/${workspaceId}/debug/request/${request._id}`;
      await expect(redirectIfResourceMoved(request, { projectId, workspaceId }, requestFor(path))).resolves.toBe(
        undefined,
      );
    });

    it('redirects to the real project and workspace when the request was moved', async () => {
      const request = await services.request.create({ name: 'Request', parentId: workspaceId });
      const path = `/organization/org_1/project/proj_old/workspace/wrk_old/debug/request/${request._id}?tab=body`;

      const thrown = await redirectIfResourceMoved(
        request,
        { projectId: 'proj_old', workspaceId: 'wrk_old' },
        requestFor(path),
      ).catch(error => error);

      expect(thrown).toBeInstanceOf(Response);
      expect(thrown.status).toBe(302);
      expect(thrown.headers.get('Location')).toBe(
        `/organization/org_1/project/${projectId}/workspace/${workspaceId}/debug/request/${request._id}?tab=body`,
      );
    });
  });
});
