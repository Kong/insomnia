import type { WebSocketRequest } from 'insomnia-data';
import { services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../common/database';
import { renderRealtimeConnectPayload } from './render-realtime-connect';
import type * as TryInterpolate from './try-interpolate';

const { tryToInterpolateRequestOrShowRenderErrorModal } = vi.hoisted(() => ({
  tryToInterpolateRequestOrShowRenderErrorModal: vi.fn(),
}));

vi.mock('./try-interpolate', () => ({
  tryToInterpolateRequestOrShowRenderErrorModal,
}));

vi.mock('../components/modals', () => ({
  showModal: vi.fn(),
}));

describe('renderRealtimeConnectPayload', () => {
  let workspaceId: string;
  let environmentId: string;
  let request: WebSocketRequest;

  const mockRendered = async (overrides: Record<string, unknown> = {}) => {
    tryToInterpolateRequestOrShowRenderErrorModal.mockResolvedValue({
      url: 'ws://localhost/api/chat/1234',
      headers: [],
      authentication: { type: 'none' },
      parameters: [],
      pathParameters: [{ name: 'id', value: '1234' }],
      workspaceCookieJar: await services.cookieJar.getOrCreateForParentId(workspaceId),
      ...overrides,
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await db.init({ inMemoryOnly: true }, true);

    const project = await services.project.create({
      _id: 'proj_render_connect',
      name: 'Render Connect Project',
    });
    const workspace = await services.workspace.create({
      _id: 'wrk_render_connect',
      name: 'Render Connect Workspace',
      parentId: project._id,
      scope: 'collection',
    });
    workspaceId = workspace._id;
    const environment = await services.environment.getOrCreateForParentId(workspaceId);
    environmentId = environment._id;

    request = await services.webSocketRequest.create({
      _id: 'ws-req_render_connect',
      name: 'WS Path Param',
      parentId: workspaceId,
      url: 'ws://localhost/api/chat/:id',
      pathParameters: [{ name: 'id', value: '1234' }],
      metaSortKey: 0,
    });
  });

  it('substitutes path parameters in the rendered url', async () => {
    await mockRendered({ url: 'ws://localhost/api/chat/:id' });

    const result = await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(result?.url).toBe('ws://localhost/api/chat/1234');
  });

  it('uses inherited folder auth and headers in the render payload', async () => {
    const folder = await services.requestGroup.create({
      _id: 'fld_render_connect',
      name: 'Folder',
      parentId: workspaceId,
      metaSortKey: 0,
      authentication: { type: 'bearer', token: 'folder-token', disabled: false },
      headers: [{ name: 'X-Folder-Header', value: 'folder-value' }],
    });
    request = await services.webSocketRequest.update(request, { parentId: folder._id });
    await mockRendered();

    await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(tryToInterpolateRequestOrShowRenderErrorModal).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          authentication: expect.objectContaining({ type: 'bearer', token: 'folder-token' }),
          headers: expect.arrayContaining([expect.objectContaining({ name: 'X-Folder-Header' })]),
        }),
      }),
    );
  });

  it('returns undefined when rendering fails', async () => {
    tryToInterpolateRequestOrShowRenderErrorModal.mockImplementation(async () => {});

    const result = await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(result).toBeUndefined();
  });

  it('computes suppressUserAgent from request settings', async () => {
    request = await services.webSocketRequest.update(request, { disableUserAgentHeader: true });
    await mockRendered();

    const result = await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(result?.suppressUserAgent).toBe(true);
  });

  it('suppresses the user agent when all user-agent headers are disabled', async () => {
    request = await services.webSocketRequest.update(request, {
      headers: [{ name: 'User-Agent', value: 'custom-agent', disabled: true }],
    });
    await mockRendered();

    const result = await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(result?.suppressUserAgent).toBe(true);
  });

  it('does not suppress the user agent when an enabled user-agent header exists on a parent folder', async () => {
    const folder = await services.requestGroup.create({
      _id: 'fld_render_connect_ua',
      name: 'UA Folder',
      parentId: workspaceId,
      metaSortKey: 0,
      headers: [{ name: 'User-Agent', value: 'folder-agent' }],
    });
    request = await services.webSocketRequest.update(request, {
      parentId: folder._id,
      headers: [{ name: 'User-Agent', value: 'custom-agent', disabled: true }],
    });
    await mockRendered({ headers: [{ name: 'User-Agent', value: 'folder-agent' }] });

    const result = await renderRealtimeConnectPayload({ request, environmentId, workspaceId });

    expect(result?.suppressUserAgent).toBe(false);
  });
});

describe('renderRealtimeConnectPayload integration', () => {
  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);
  });

  it('templates path parameter values from environment variables', async () => {
    const actual = await vi.importActual<typeof TryInterpolate>('./try-interpolate');
    tryToInterpolateRequestOrShowRenderErrorModal.mockImplementation(
      actual.tryToInterpolateRequestOrShowRenderErrorModal,
    );

    const project = await services.project.create({
      _id: 'proj_render_connect_env',
      name: 'Render Connect Env Project',
    });
    const workspace = await services.workspace.create({
      _id: 'wrk_render_connect_env',
      name: 'Render Connect Env Workspace',
      parentId: project._id,
      scope: 'collection',
    });
    const environment = await services.environment.getOrCreateForParentId(workspace._id);
    await services.environment.update(environment, { data: { chatId: '5678' } });

    const request = await services.webSocketRequest.create({
      _id: 'ws-req_render_connect_env',
      name: 'WS Env Path Param',
      parentId: workspace._id,
      url: 'ws://localhost/api/chat/:id',
      pathParameters: [{ name: 'id', value: '{{ _.chatId }}' }],
      metaSortKey: 0,
    });

    const result = await renderRealtimeConnectPayload({
      request,
      environmentId: environment._id,
      workspaceId: workspace._id,
    });

    expect(result?.url).toBe('ws://localhost/api/chat/5678');
  });
});
