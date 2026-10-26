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

// Builds the (params, request) pair `clientAction` expects. `useRequestDeleteActionFetcher`
// always submits to the fixed `.../debug/request/delete` action URL (the id only ever
// travels in the form body), so that's what every caller's `request.url` looks like in practice.
const buildArgs = ({ workspaceId, requestId }: { workspaceId: string; requestId: string }) => {
  const formData = new FormData();
  formData.append('id', requestId);
  return {
    params: { organizationId: ORG_ID, projectId: PROJECT_ID, workspaceId },
    request: new Request(
      `http://localhost/organization/${ORG_ID}/project/${PROJECT_ID}/workspace/${workspaceId}/debug/request/delete`,
      { method: 'POST', body: formData },
    ),
  } as any;
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

  it('clears activeRequestId and does not redirect when the deleted request was the active request', async () => {
    const workspace = await services.workspace.create({ name: 'W' });
    const request = await services.request.create({ name: 'R1', parentId: workspace._id, url: 'r1.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(response).toBeNull();
    await expect(services.helpers.getRequestById(request._id)).resolves.toBeUndefined();
    await expect(services.workspaceMeta.getByParentId(workspace._id)).resolves.toMatchObject({ activeRequestId: null });
  });

  it.each([
    ['gRPC', services.grpcRequest.create],
    ['WebSocket', services.webSocketRequest.create],
    ['Socket.IO', services.socketIORequest.create],
  ])('clears activeRequestId for a %s request too', async (_label, create) => {
    const workspace = await services.workspace.create({ name: 'W' });
    const request = await create({ name: 'Non-HTTP request', parentId: workspace._id, url: 'x.url' });
    await services.workspaceMeta.create({ parentId: workspace._id, activeRequestId: request._id });

    const response = await clientAction(buildArgs({ workspaceId: workspace._id, requestId: request._id }));

    expect(response).toBeNull();
    await expect(services.workspaceMeta.getByParentId(workspace._id)).resolves.toMatchObject({ activeRequestId: null });
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

  it('throws when the request does not exist', async () => {
    const workspace = await services.workspace.create({ name: 'W' });

    await expect(
      clientAction(buildArgs({ workspaceId: workspace._id, requestId: 'req_does_not_exist' })),
    ).rejects.toThrow('Request not found');
  });
});
