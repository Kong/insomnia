import type { BaseServices, McpRequest } from '~/insomnia-data';

export type McpRequestService = BaseServices<'McpRequest'> & {
  clearResourceSubscriptions(requestId: string): Promise<McpRequest>;
};
