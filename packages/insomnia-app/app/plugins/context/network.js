// @flow

import { send } from '../../network/network';
import type { Request } from '../../models/request';
import * as models from '../../models';

export function init(activeEnvironmentId: string | null): { network: Object } {
  const network = {
    async sendRequest(request: Request): Promise<Response> {
      const responsePatch = await send(request._id, activeEnvironmentId);
      const settings = await models.settings.getOrCreate();
      return models.response.create(responsePatch, settings.maxHistoryResponses);
    },
  };

  return { network };
}
