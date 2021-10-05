import type { ExtraRenderInfo } from '../../common/render';
import * as models from '../../models';
import type { Request } from '../../models/request';
import { send } from '../../network/network';

export function init(activeEnvironmentId: string | null) {
  return {
    network: {
      async sendRequest(request: Request, extraInfo?: ExtraRenderInfo) {
        const responsePatch = await send(request._id, activeEnvironmentId || undefined, extraInfo);
        const settings = await models.settings.getOrCreate();
        return models.response.create(responsePatch, settings.maxHistoryResponses);
      },
    },
  };
}
