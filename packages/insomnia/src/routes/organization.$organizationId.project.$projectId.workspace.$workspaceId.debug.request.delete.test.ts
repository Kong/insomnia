/**
 * Tests run against the in-memory NeDB initialized by setup-vitest.ts.
 * window.main is stubbed globally so trackAnalyticsEvent calls don't throw.
 */
import { initDatabase, services } from 'insomnia-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mainDatabase } from '~/main/database.main';

import { clientAction } from './organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';

const ORG_ID = 'org_1';
const PROJECT_ID = 'proj_1';

const trackAnalyticsEvent = vi.fn();

// Builds the (params, request) pair `clientAction` expects. `request.url` is
// only inspected for `.includes(id)`, mirroring the real router URL for the
// request's own debug page.
const buildArgs = ({ workspaceId, requestId, requestUrl }: { workspaceId: string; requestId: string; requestUrl?: string }) => {
  const formData = new FormData();
  formData.append('id', requestId);
  return {
    params: { organizationId: ORG_ID, projectId: PROJECT_ID, workspaceId },
    request: new Request(
      requestUrl ??
        `http://localhost/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspaceId}/debug/request/${requestId}`,
      { method: 'POST', body: formData },
    ),
  } as any;
};

const locationOf = (response: unknown) => {
  expect(response).toBeInstanceOf(Response);
  return (response as Response).headers.get('Location');
};

describe('debug.request.delete clientAction', () => {
  beforeEach(async () => {
    // Re-init with fresh in-memory NeDB buckets — clean slate for every test.
    await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
    vi.stubGlobal('window', { main: { trackAnalyticsEvent } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('redirects to the collection root when the deleted request was a direct child of the workspace', async () => {
    const workspace = await services.workspace.create({ name: 'W' });
    const request = await services.request.create({ name: 'R1', parentId: workspace._id, url: 'r1.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(locationOf(response)).toBe(`/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspace._id}/debug`);
    await expect(services.helpers.getRequestById(request._id)).resolves.toBeUndefined();
    await expect(services.workspaceMeta.getByParentId(workspace._id)).resolves.toMatchObject({ activeRequestId: null });
  });

  it('redirects to the parent folder when the deleted request lived in a folder', async () => {
    const workspace = await services.workspace.create({ name: 'W' });
    const folder = await services.requestGroup.create({ name: 'Folder', parentId: workspace._id });
    const request = await services.request.create({ name: 'R2', parentId: folder._id, url: 'r2.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(locationOf(response)).toBe(
      `/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspace._id}/debug/request-group/${folder._id}`,
    );
  });

  it.each([
    ['gRPC', services.grpcRequest.create],
    ['WebSocket', services.webSocketRequest.create],
    ['Socket.IO', services.socketIORequest.create],
  ])('redirects to the parent folder for a %s request too', async (_label, create) => {
    const workspace = await services.workspace.create({ name: 'W' });
    const folder = await services.requestGroup.create({ name: 'Folder', parentId: workspace._id });
    const request = await create({ name: 'Non-HTTP request', parentId: folder._id, url: 'x.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(locationOf(response)).toBe(
      `/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspace._id}/debug/request-group/${folder._id}`,
    );
  });

  it('removes the request from the database regardless of whether it was the active request', async () => {
    const workspace = await services.workspace.create({ name: 'W' });
    const request = await services.request.create({ name: 'R3', parentId: workspace._id, url: 'r3.url' });
    const otherRequest = await services.request.create({ name: 'R4', parentId: workspace._id, url: 'r4.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: otherRequest._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(response).toBeNull();
    await expect(services.helpers.getRequestById(request._id)).resolves.toBeUndefined();
    // the active request bookkeeping is untouched since the deleted request wasn't the active one
    await expect(services.workspaceMeta.getByParentId(workspace._id)).resolves.toMatchObject({
      activeRequestId: otherRequest._id,
    });
  });

  it('resets activeRequestId but does not redirect when the delete did not happen from the request\'s own page', async () => {
    const workspace = await services.workspace.create({ name: 'W' });
    const request = await services.request.create({ name: 'R5', parentId: workspace._id, url: 'r5.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    // e.g. deleted via the sidebar while looking at the collection root, not the request's own tab
    const response = await clientAction(
      buildArgs({
        workspaceId: workspace._id,
        requestId: request._id,
        requestUrl: `http://localhost/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspace._id}/debug`,
      }),
    );

    expect(response).toBeNull();
    await expect(services.workspaceMeta.getByParentId(workspace._id)).resolves.toMatchObject({ activeRequestId: null });
  });

  it('throws when the request does not exist', async () => {
    const workspace = await services.workspace.create({ name: 'W' });

    await expect(
      clientAction(buildArgs({ workspaceId: workspace._id, requestId: 'req_does_not_exist' })),
    ).rejects.toThrow('Request not found');
  });
});
