// @flow

import { send } from '../../network/network';
import type { Request } from '../../models/request';
import * as models from '../../models';
import type { ExtraRenderInfo } from '../../common/render';

export function init(activeEnvironmentId: string | null): { network: Object } {
  const network = {
    async sendRequest(request: Request, extraInfo?: ExtraRenderInfo): Promise<Response> {
      const responsePatch = await send(request._id, activeEnvironmentId, extraInfo);
      const settings = await models.settings.getOrCreate();
      return models.response.create(responsePatch, settings.maxHistoryResponses);
    },
  };

  return { network };
}
