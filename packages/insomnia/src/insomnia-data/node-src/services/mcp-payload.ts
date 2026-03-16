import { database } from '../../src/database';
import { models } from '../../src/models';
import { type McpPayload } from '../../src/models/types';

const { type, name } = models.mcpPayload;

export const create = (patch: Partial<McpPayload> = {}) => {
  if (!patch.parentId) {
    throw new Error(`New McpPayload missing \`parentId\`: ${JSON.stringify(patch)}`);
  }

  return database.docCreate<McpPayload>(type, patch);
};

export const remove = (obj: McpPayload) => database.remove(obj);

export const update = (obj: McpPayload, patch: Partial<McpPayload> = {}) => database.docUpdate(obj, patch);

export async function duplicate(request: McpPayload, patch: Partial<McpPayload> = {}) {
  // Only set name and "(Copy)" if the patch does
  // not define it and the request itself has a name.
  // Otherwise leave it blank so the request URL can
  // fill it in automatically.
  if (!patch.name && request.name) {
    patch.name = `${request.name} (Copy)`;
  }

  return database.duplicate<McpPayload>(request, {
    name,
    ...patch,
  });
}

export const getById = (_id: string) => database.findOne<McpPayload>(type, { _id });

export const getByParentIdAndUrl = (parentId: string, url: string) =>
  database.findOne<McpPayload>(type, { parentId, url });

export async function updateOrCreateByParentIdAndUrl(parentId: string, patch: Partial<McpPayload>) {
  const requestPayload = await getByParentIdAndUrl(parentId, patch.url || '');

  if (requestPayload) {
    return update(requestPayload, patch);
  }
  const newPatch = Object.assign(
    {
      parentId,
    },
    patch,
  );
  return create(newPatch);
}

export async function getOrCreateByParentIdAndUrl(parentId: string, url: string) {
  const result = await database.findOne<McpPayload>(type);

  if (!result) {
    return await create({
      parentId,
      url,
    });
  }
  return result;
}

export const all = () => database.find<McpPayload>(type);
