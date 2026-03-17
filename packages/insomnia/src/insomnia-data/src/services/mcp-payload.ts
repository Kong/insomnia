import type { BaseServices, McpPayload } from '~/insomnia-data';

export type McpPayloadService = BaseServices<'McpPayload'> & {
  getByParentIdAndUrl(parentId: string, url: string): Promise<McpPayload | void>;
  updateOrCreateByParentIdAndUrl(parentId: string, patch: Partial<McpPayload>): Promise<McpPayload>;
  getOrCreateByParentIdAndUrl(parentId: string, url: string): Promise<McpPayload>;
};
