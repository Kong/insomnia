import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMock, upsertMock, bufferChangesMock, flushChangesMock } = vi.hoisted(() => ({
  updateMock: vi.fn(async (doc: any) => doc),
  upsertMock: vi.fn(async (doc: any) => doc),
  bufferChangesMock: vi.fn(async () => 1),
  flushChangesMock: vi.fn(async () => {}),
}));

vi.mock('insomnia-data', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('insomnia-data')),
  database: { update: updateMock, bufferChanges: bufferChangesMock, flushChanges: flushChangesMock },
  services: { workspace: { upsert: upsertMock } },
}));
vi.mock('~/sync/access-error', () => ({ interceptAccessError: ({ callback }: any) => callback() }));

import { pullBackendProject } from './pull-backend-project';

const makeVcs = (docs: any[], branches = ['master']) =>
  ({
    setBackendProject: vi.fn(async () => {}),
    checkout: vi.fn(async () => {}),
    getRemoteBranchNames: vi.fn(async () => branches),
    pull: vi.fn(async () => {}),
    allDocuments: vi.fn(async () => docs),
  }) as any;

const backendProject = { id: 'bp_1', name: 'bp', rootDocumentId: 'wrk_1' } as any;
const remoteProject = { _id: 'proj_1', parentId: 'org_1' } as any;
const now = Date.now();
const doc = (type: string, _id: string, parentId = 'wrk_1') => ({ type, _id, parentId, created: now, modified: now });

describe('pullBackendProject doc validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes docs with well-formed ids', async () => {
    const docs = [
      doc('Workspace', 'wrk_0123456789abcdef0123456789abcdef', 'proj_x'),
      doc('Request', 'req_0123456789abcdef0123456789abcdef'),
      doc('Environment', '__BASE_ENVIRONMENT_ID__'),
      doc('ProtoFile', 'pf_abc-DEF_123'),
    ];
    await pullBackendProject({ vcs: makeVcs(docs), backendProject, remoteProject });
    expect(updateMock).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['_id with traversal', doc('ProtoFile', 'pf_../../../x')],
    ['_id with backslash', doc('Request', 'req_..\\..\\x')],
    ['_id with NUL', doc('Request', 'req_a\0b')],
    ['_id absolute', doc('Request', '/etc/passwd')],
    ['_id empty', doc('Request', '')],
    ['parentId with traversal', doc('Request', 'req_ok', '../../x')],
  ])('rejects a doc with %s before any database write', async (_name, bad) => {
    const docs = [doc('Request', 'req_good'), bad];
    await expect(pullBackendProject({ vcs: makeVcs(docs), backendProject, remoteProject })).rejects.toThrow(/Refusing/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects a non-string type', async () => {
    const docs = [{ ...doc('Request', 'req_ok'), type: { a: 1 } }];
    await expect(pullBackendProject({ vcs: makeVcs(docs), backendProject, remoteProject })).rejects.toThrow(/Refusing/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('rejects an unsafe backend project root document id when creating the workspace', async () => {
    await expect(
      pullBackendProject({
        vcs: makeVcs([], []),
        backendProject: { ...backendProject, rootDocumentId: 'wrk_../../x' },
        remoteProject,
      }),
    ).rejects.toThrow(/Refusing/);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
