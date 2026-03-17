import { database as db, type McpResponse, type Services } from '~/insomnia-data';
import * as models from '~/models';

import { createBaseOperations } from './base';

const type = models.mcpResponse.type;
const baseOperations = createBaseOperations(type);

export const mcpResponseService: Services['mcpResponse'] = {
  ...baseOperations,

  async create(patch: Partial<McpResponse> = {}, maxResponses = 20) {
    if (!patch.parentId) {
      throw new Error('New Response missing `parentId`');
    }

    const { parentId } = patch;
    // Create request version snapshot
    const request = await models.request.getById(parentId);
    const requestVersion = request ? await models.requestVersion.create(request) : null;
    patch.requestVersionId = requestVersion ? requestVersion._id : null;
    // Filter responses by environment if setting is enabled
    const query: Record<string, any> = {
      parentId,
    };

    if ((await models.settings.get()).filterResponsesByEnv && 'environmentId' in patch) {
      query.environmentId = patch.environmentId;
    }

    // Delete all other responses before creating the new one
    const responsesToShow = Math.max(1, maxResponses);

    const allResponses = await db.find<McpResponse>(type, query, { modified: -1 }, responsesToShow);

    const recentIds = allResponses.map(r => r._id);
    // Remove all that were in the last query, except the first `maxResponses` IDs
    await db.removeWhere(type, {
      ...query,
      _id: {
        $nin: recentIds,
      },
    });
    // Actually create the new response
    return db.docCreate(type, patch);
  },

  async updateOrCreate(patch: Partial<McpResponse>, maxResponses = 20) {
    const id = patch._id;
    if (!id) {
      throw new Error('Cannot updateOrCreate McpResponse without _id');
    }

    const existing = await baseOperations.getById(id);
    if (existing) {
      return db.docUpdate(existing, patch);
    }

    return this.create(patch, maxResponses);
  },

  async getLatestForRequestId(requestId: string, environmentId: string | null) {
    // Filter responses by environment if setting is enabled
    const shouldFilter = (await models.settings.get()).filterResponsesByEnv;

    const response = await db.findOne<McpResponse>(
      type,
      {
        parentId: requestId,
        ...(shouldFilter ? { environmentId } : {}),
      },
      { modified: -1 },
    );
    return response;
  },
};
