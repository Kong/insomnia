import { database } from 'insomnia-data';
import { servicesNodeImpl } from 'insomnia-data/node';
import { beforeEach, describe, expect, it } from 'vitest';

import { getAllCollectionChildrenAndMetasByWorkspaceIds } from './workspace-data';

describe('getAllCollectionChildrenAndMetasByWorkspaceIds', () => {
  beforeEach(async () => {
    await database.init({ inMemoryOnly: true }, true);
  });

  it('walks nested request groups and collects their requests', async () => {
    const workspace = await servicesNodeImpl.workspace.create({ scope: 'collection' });
    const folder = await servicesNodeImpl.requestGroup.create({ parentId: workspace._id, name: 'folder' });
    const subfolder = await servicesNodeImpl.requestGroup.create({ parentId: folder._id, name: 'subfolder' });
    const request = await servicesNodeImpl.request.create({ parentId: subfolder._id, name: 'req' });

    const result = await getAllCollectionChildrenAndMetasByWorkspaceIds([workspace._id]);

    const ids = result.get(workspace._id)!.data.requestsAndGroups.map(doc => doc._id);
    expect(ids.sort()).toEqual([folder._id, request._id, subfolder._id].sort());
  });
});
