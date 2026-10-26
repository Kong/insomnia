import type { WebSocketRequest } from 'insomnia-data';
import { EnvironmentKvPairDataType, services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { database as db } from '../../common/database';
import { tryToInterpolateRequestAndCollectSensitiveValues } from './try-interpolate';

vi.mock('../components/modals', () => ({
  showModal: vi.fn(),
}));

const SECRET = 'super-secret-token';

// The realtime protocols (WS/SocketIO/MCP) write their timelines in the main process, so the only
// thing keeping secrets off disk is this function handing main the values it collected while
// rendering. Both halves of that contract are asserted here: the render still yields the real
// value to send, and the snapshot reflects the setting.
describe('tryToInterpolateRequestAndCollectSensitiveValues', () => {
  let environmentId: string;
  let request: WebSocketRequest;

  beforeEach(async () => {
    await db.init({ inMemoryOnly: true }, true);

    const project = await services.project.create({ _id: 'proj_collect', name: 'Collect Project' });
    const workspace = await services.workspace.create({
      _id: 'wrk_collect',
      name: 'Collect Workspace',
      parentId: project._id,
      scope: 'collection',
    });

    const environment = await services.environment.getOrCreateForParentId(workspace._id);
    await services.environment.update(environment, {
      data: { token: SECRET },
      kvPairData: [
        {
          id: 'envPair_token',
          name: 'token',
          value: SECRET,
          type: EnvironmentKvPairDataType.STRING,
          enabled: true,
          isConfidential: true,
        },
      ],
    });
    environmentId = environment._id;

    request = await services.webSocketRequest.create({
      _id: 'ws-req_collect',
      name: 'WS Collect',
      parentId: workspace._id,
      url: 'ws://localhost/chat',
      metaSortKey: 0,
    });
  });

  const setHideSecretValues = async (hideSecretValues: boolean) => {
    const settings = await services.settings.getOrCreate();
    await services.settings.update(settings, { hideSecretValuesInPreviewAndConsole: hideSecretValues });
  };

  it('renders the real value and returns it for main-process redaction when the setting is on', async () => {
    await setHideSecretValues(true);

    const result = await tryToInterpolateRequestAndCollectSensitiveValues({
      request,
      environmentId,
      payload: 'Bearer {{ _.token }}',
    });

    expect(result?.rendered).toBe(`Bearer ${SECRET}`);
    expect(result?.sensitiveValues).toContain(SECRET);
  });

  it('collects nothing when the setting is off, so main redacts nothing', async () => {
    await setHideSecretValues(false);

    const result = await tryToInterpolateRequestAndCollectSensitiveValues({
      request,
      environmentId,
      payload: 'Bearer {{ _.token }}',
    });

    expect(result?.rendered).toBe(`Bearer ${SECRET}`);
    expect(result?.sensitiveValues).toEqual([]);
  });
});
