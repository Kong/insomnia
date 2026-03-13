import { database, type McpPayload, models, type Services } from '~/insomnia-data';

import { createBaseOperations } from './base';

const type = models.mcpPayload.type;
const baseOperations = createBaseOperations(type);

export const mcpPayloadService: Services['mcpPayload'] = {
  ...baseOperations,
  getByParentIdAndUrl(parentId: string, url: string) {
    return database.findOne<McpPayload>(type, { parentId, url });
  },

  async updateOrCreateByParentIdAndUrl(parentId: string, patch: Partial<McpPayload>) {
    const requestPayload = await this.getByParentIdAndUrl(parentId, patch.url || '');

    if (requestPayload) {
      return baseOperations.update(requestPayload, patch);
    }
    const newPatch = Object.assign(
      {
        parentId,
      },
      patch,
    );
    return baseOperations.create(newPatch);
  },

  async getOrCreateByParentIdAndUrl(parentId: string, url: string) {
    //! TODO: What's this?
    const result = await database.findOne<McpPayload>(type);

    if (!result) {
      return await baseOperations.create({
        parentId,
        url,
      } as Partial<McpPayload>);
    }
    return result;
  },
};
