import { type McpRequest, models, type Services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';

import { createBaseOperations } from './base';

const baseOperations = createBaseOperations(models.mcpRequest.type);

export const mcpRequestService: Services['mcpRequest'] = {
  ...baseOperations,
  async clearResourceSubscriptions(requestId: string) {
    const request = await baseOperations.getById(requestId);
    invariant(request, 'McpRequest not found');
    return baseOperations.update(request, { subscribeResources: [] } as Partial<McpRequest>);
  },
};
