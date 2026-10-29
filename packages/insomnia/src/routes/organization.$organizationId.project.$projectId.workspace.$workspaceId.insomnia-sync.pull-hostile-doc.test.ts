/**
 * A project member (or a compromised sync service) can publish a blob whose decrypted doc carries any `_id`,
 * `parentId`, `type` or `modified`: blob content is encrypted end to end. Only the first pull validates
 * docs (pullBackendProject -> assertSafeSyncedDoc). The routine pull route applies the VCS delta straight
 * into the database, so the hostile doc must be refused there or upstream of it.
 *
 * The VCS is real (in-memory store, real merge/delta code); only the network methods are stubbed.
 */
import { initDatabase, services } from 'insomnia-data';
import { configureStore, MemoryDriver, VCS } from 'insomnia-vcs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { database } from '~/common/database';
import { mainDatabase } from '~/main/database.main';

import { clientAction } from './organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.pull';

const ORG_ID = 'org_1';
const REMOTE_PROJECT_ID = 'prj_remote_1';
const LOCAL_BLOB_ID = 'c'.repeat(40);
const SNAPSHOT_ID = 'd'.repeat(40);
const VICTIM_REQUEST_ID = 'req_victim';

// `key` is the sync state key (visible to the sync service, validated against ^[A-Za-z0-9_-]{1,255}$).
// `doc` is the encrypted content (encrypted): every field is attacker-controlled.
// Blob plaintext is the gzip form the store's read hook expects (see store/index.ts compress hook).
const hostileBlobDoc = async (doc: Record<string, unknown>) => {
  const gzipped = new Blob([JSON.stringify(doc)]).stream().pipeThrough(new CompressionStream('gzip'));
  return Buffer.from(await new Response(gzipped).arrayBuffer());
};

describe('insomnia-sync pull route with hostile blob content', () => {
  let projectId: string;
  let workspaceId: string;
  let vcs: VCS;
  let blobs: Record<string, Buffer>;

  // The route's clientAction calls window.main.sync.pull(workspaceId, opts). Route it to the real VCS.
  const trackAnalyticsEvent = vi.fn();

  async function setup(stateKey: string, doc: Record<string, unknown>) {
    blobs = { [LOCAL_BLOB_ID]: await hostileBlobDoc(doc) };
    const now = new Date();
    vi.spyOn(vcs, '_getOrCreateRemoteBackendProject').mockResolvedValue({} as any);
    vi.spyOn(vcs, '_queryBranch').mockResolvedValue({
      name: 'main',
      created: now,
      modified: now,
      snapshots: [SNAPSHOT_ID],
    });
    vi.spyOn(vcs, '_querySnapshots').mockResolvedValue([
      {
        id: SNAPSHOT_ID,
        created: now,
        parent: '',
        author: 'remote',
        name: 'remote',
        description: '',
        state: [{ key: stateKey, blob: LOCAL_BLOB_ID, name: 'x' }],
      },
    ] as any);
    vi.spyOn(vcs, '_queryBlobs').mockResolvedValue(blobs);
    vi.spyOn(vcs, '_queryBlobsMissing').mockResolvedValue([]);
    vi.stubGlobal('window', {
      main: {
        trackAnalyticsEvent,
        sync: {
          pull: (_workspaceId: string, opts: any) => vcs.pull({ ...opts, teamProjectId: REMOTE_PROJECT_ID }),
        },
      },
    });
  }

  beforeEach(async () => {
    await initDatabase(mainDatabase, { inMemoryOnly: true }, true);
    configureStore(new MemoryDriver());
    const workspace = await services.workspace.create({ name: 'W' });
    workspaceId = workspace._id;
    await services.environment.getOrCreateForParentId(workspaceId);
    const project = await services.project.create({
      _id: 'proj_local_1',
      name: 'P',
      remoteId: REMOTE_PROJECT_ID,
      parentId: ORG_ID,
    } as any);
    projectId = project._id;
    await services.request.create({ _id: VICTIM_REQUEST_ID, name: 'Victim', parentId: workspaceId } as any);

    vcs = new VCS({ workspaceId });
    await vcs.switchAndCreateBackendProjectIfNotExist(workspaceId, 'W');
    await vcs.checkout([], 'main');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function pullArgs() {
    return {
      params: { organizationId: ORG_ID, projectId, workspaceId },
      request: new Request(
        `http://localhost/organization/${ORG_ID}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/pull`,
        {
          method: 'POST',
        },
      ),
    } as any;
  }

  function upsertedIds() {
    const spy = vi.mocked(database.batchModifyDocs);
    return spy.mock.calls.flatMap(([op]) => (op.upsert ?? []).map((d: any) => d._id));
  }

  it('control: a benign doc under a matching key is applied through the route', async () => {
    await setup('req_ok', { _id: 'req_ok', type: 'Request', parentId: workspaceId, name: 'Benign', modified: 1 });
    const spy = vi.spyOn(database, 'batchModifyDocs');
    const result = await clientAction(pullArgs());
    expect(result).toEqual({ success: true });
    expect(upsertedIds()).toContain('req_ok');
    spy.mockRestore();
  });

  it('path-traversal _id under a valid state key never reaches batchModifyDocs', async () => {
    await setup('wrk_ok', { _id: '../../../tmp/pwn', type: 'ProtoFile', parentId: workspaceId, modified: '1/../x' });
    const spy = vi.spyOn(database, 'batchModifyDocs');
    await clientAction(pullArgs());
    const unsafe = upsertedIds().filter(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,255}$/.test(id));
    expect(unsafe).toEqual([]);
    spy.mockRestore();
  });

  it('valid-looking _id that differs from its state key cannot overwrite a local doc', async () => {
    await setup('wrk_ok', {
      _id: VICTIM_REQUEST_ID,
      type: 'Request',
      parentId: workspaceId,
      name: 'PWNED',
      modified: 1,
    });
    await clientAction(pullArgs());
    const victim = await services.request.getById(VICTIM_REQUEST_ID);
    expect(victim?.name).toBe('Victim');
  });
});
