/**
 * @vitest-environment jsdom
 */
import { services } from 'insomnia-data';
import { beforeAll, describe, expect, it } from 'vitest';

import { getSyncItems } from '../sync-utils';

let sequence = 0;

// Each test needs its own collection: the in-memory database lives for the whole
// file.
const createCollection = async () => {
  const id = ++sequence;
  const workspaceId = `wrk_sync_examples_${id}`;
  const requestId = `req_sync_examples_${id}`;
  const exampleId = `exp_sync_examples_${id}`;
  await services.workspace.create({
    _id: workspaceId,
    name: `Collection ${id}`,
    parentId: 'proj_sync_examples',
    scope: 'collection',
  });
  await services.environment.getOrCreateForParentId(workspaceId);
  await services.request.create({
    _id: requestId,
    name: 'Request',
    parentId: workspaceId,
    url: 'https://example.com',
    method: 'GET',
    metaSortKey: 0,
  });
  await services.example.create({ _id: exampleId, parentId: requestId, name: '200 OK', metaSortKey: 0 });
  return { workspaceId, requestId, exampleId };
};

describe('getSyncItems — examples', () => {
  beforeAll(async () => {
    await services.settings.getOrCreate();
    await services.project.create({ _id: 'proj_sync_examples', name: 'Sync project' });
  });

  it('snapshots an example alongside its request', async () => {
    const { workspaceId, exampleId } = await createCollection();

    const { syncItems } = await getSyncItems({ workspaceId });

    expect(syncItems.map(item => item.key)).toContain(exampleId);
  });

  // A document that is in the last snapshot but not in the candidates is a
  // *deletion* to the VCS (`insomnia-vcs` getStagable: "entry && !candidate" →
  // `deleted: true`), not a skipped document. Leaving an example out once its
  // request stops hosting examples therefore drops it from the cloud snapshot —
  // deliberately, and recoverable by rolling back to an earlier snapshot.
  it('drops an example from the snapshot once its request stops hosting them', async () => {
    const { workspaceId, requestId, exampleId } = await createCollection();
    await services.request.update((await services.request.getById(requestId))!, {
      body: { mimeType: 'application/graphql' },
    });

    const { syncItems } = await getSyncItems({ workspaceId });

    expect(syncItems.map(item => item.key)).not.toContain(exampleId);
    // The document itself is untouched: only the snapshot stops carrying it.
    expect(await services.example.getById(exampleId)).toBeDefined();
  });
});
