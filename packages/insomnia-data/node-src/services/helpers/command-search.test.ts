import { services } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

import { abortCommandSearch, commandSearch } from './command-search';

let seq = 0;
const uid = (prefix: string) => `${prefix}_cs_${++seq}`;

function makeOrg() {
  const id = uid('org');
  return { organizationId: id, allOrganizations: [{ id, name: `Org ${id}` }] };
}

describe('search()', () => {
  it('returns empty results when the org has no projects', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: uid('proj'),
      workspaceId: null,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toEqual({
      requestId: expect.any(String),
      current: { requests: [], files: [], environments: [] },
      other: { requests: [], files: [] },
    });
  });

  it('partitions requests: current workspace vs other workspaces', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const ws1Id = uid('wrk');
    const ws2Id = uid('wrk');
    await services.workspace.create({ _id: ws1Id, name: 'WS1', parentId: projId, scope: 'collection' });
    await services.workspace.create({ _id: ws2Id, name: 'WS2', parentId: projId, scope: 'collection' });
    const r1 = await services.request.create({ _id: uid('r'), name: 'Req1', parentId: ws1Id, url: 'http://a.com' });
    const r2 = await services.request.create({ _id: uid('r'), name: 'Req2', parentId: ws2Id, url: 'http://b.com' });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: ws1Id,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { requests: [{ id: r1._id }] },
      other: { requests: [{ id: r2._id }] },
    });
  });

  it('partitions files: current project vs other projects', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const proj1Id = uid('proj');
    const proj2Id = uid('proj');
    await services.project.create({ _id: proj1Id, name: 'P1', parentId: organizationId });
    await services.project.create({ _id: proj2Id, name: 'P2', parentId: organizationId });
    const ws1 = await services.workspace.create({
      _id: uid('wrk'),
      name: 'File1',
      parentId: proj1Id,
      scope: 'collection',
    });
    const ws2 = await services.workspace.create({
      _id: uid('wrk'),
      name: 'File2',
      parentId: proj2Id,
      scope: 'collection',
    });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: proj1Id,
      workspaceId: null,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { files: [{ id: ws1._id }] },
      other: { files: [{ id: ws2._id }] },
    });
  });

  it('filters requests by fuzzy match on name/url', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    const match = await services.request.create({
      _id: uid('r'),
      name: 'Get Users',
      parentId: wsId,
      url: 'http://api.com/users',
    });
    await services.request.create({ _id: uid('r'), name: 'Totally Different', parentId: wsId, url: 'http://zzz.com' });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: wsId,
      filter: 'users',
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { requests: [{ id: match._id, name: 'Get Users' }] },
    });
  });

  it('filters files (workspaces) by fuzzy match on name', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const matchWs = await services.workspace.create({
      _id: uid('wrk'),
      name: 'Payments API',
      parentId: projId,
      scope: 'collection',
    });
    await services.workspace.create({
      _id: uid('wrk'),
      name: 'Completely Unrelated',
      parentId: projId,
      scope: 'collection',
    });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: null,
      filter: 'payments',
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { files: [{ id: matchWs._id, name: 'Payments API' }] },
    });
  });

  it('includes base env + sub-environments when workspaceId is set', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    const baseEnv = await services.environment.create({ _id: uid('env'), name: 'Base Environment', parentId: wsId });
    const prodEnv = await services.environment.create({ _id: uid('env'), name: 'Production', parentId: baseEnv._id });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: wsId,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: {
        environments: expect.arrayContaining([
          expect.objectContaining({ _id: baseEnv._id }),
          expect.objectContaining({ _id: prodEnv._id }),
        ]),
      },
    });
  });

  it('returns no environments when workspaceId is null', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    await services.environment.create({ _id: uid('env'), name: 'Base Environment', parentId: wsId });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: null,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({ current: { environments: [] } });
  });

  it('filters environments by fuzzy match on name', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    const baseEnv = await services.environment.create({ _id: uid('env'), name: 'Base Environment', parentId: wsId });
    const matchEnv = await services.environment.create({ _id: uid('env'), name: 'Production', parentId: baseEnv._id });
    await services.environment.create({ _id: uid('env'), name: 'Development', parentId: baseEnv._id });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: wsId,
      filter: 'production',
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { environments: [expect.objectContaining({ _id: matchEnv._id, name: 'Production' })] },
    });
  });

  it('finds requests nested inside request groups (2 levels deep)', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    const folder = await services.requestGroup.create({ _id: uid('rg'), name: 'Auth', parentId: wsId });
    const nested = await services.requestGroup.create({ _id: uid('rg'), name: 'OAuth', parentId: folder._id });
    const req = await services.request.create({
      _id: uid('r'),
      name: 'Token',
      parentId: nested._id,
      url: 'http://auth.com',
    });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: wsId,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { requests: [{ id: req._id, name: 'Token' }] },
    });
  });

  it('includes grpcRequests and webSocketRequests', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'WS', parentId: projId, scope: 'collection' });
    const grpc = await services.grpcRequest.create({
      _id: uid('gr'),
      name: 'GrpcCall',
      parentId: wsId,
      url: 'grpc://svc',
    });
    const wsr = await services.webSocketRequest.create({
      _id: uid('ws'),
      name: 'WsEvent',
      parentId: wsId,
      url: 'ws://svc',
    });

    const result = await commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: wsId,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: {
        requests: expect.arrayContaining([
          expect.objectContaining({ id: grpc._id, name: 'GrpcCall' }),
          expect.objectContaining({ id: wsr._id, name: 'WsEvent' }),
        ]),
      },
    });
  });

  it('builds the correct request URL and metadata fields', async () => {
    const orgId = uid('org');
    const allOrganizations = [{ id: orgId, name: 'My Org' }];
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'My Project', parentId: orgId });
    const wsId = uid('wrk');
    await services.workspace.create({ _id: wsId, name: 'My WS', parentId: projId, scope: 'collection' });
    const req = await services.request.create({
      _id: uid('r'),
      name: 'Get Items',
      parentId: wsId,
      url: 'http://example.com',
    });

    const result = await commandSearch({
      allOrganizations,
      organizationId: orgId,
      projectId: projId,
      workspaceId: wsId,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: {
        requests: [
          {
            id: req._id,
            name: 'Get Items',
            url: `/organization/${orgId}/project/${projId}/workspace/${wsId}/debug/request/${req._id}`,
            organizationId: orgId,
            projectId: projId,
            workspaceId: wsId,
            organizationName: 'My Org',
            projectName: 'My Project',
            workspaceName: 'My WS',
          },
        ],
      },
    });
  });

  it('aggregates requests across multiple organizations', async () => {
    const orgAId = uid('org');
    const orgBId = uid('org');
    const allOrganizations = [
      { id: orgAId, name: 'Org A' },
      { id: orgBId, name: 'Org B' },
    ];
    const projA = await services.project.create({ _id: uid('proj'), name: 'ProjA', parentId: orgAId });
    const projB = await services.project.create({ _id: uid('proj'), name: 'ProjB', parentId: orgBId });
    const wsA = await services.workspace.create({
      _id: uid('wrk'),
      name: 'WsA',
      parentId: projA._id,
      scope: 'collection',
    });
    const wsB = await services.workspace.create({
      _id: uid('wrk'),
      name: 'WsB',
      parentId: projB._id,
      scope: 'collection',
    });
    const reqA = await services.request.create({ _id: uid('r'), name: 'ReqA', parentId: wsA._id, url: 'http://a.com' });
    const reqB = await services.request.create({ _id: uid('r'), name: 'ReqB', parentId: wsB._id, url: 'http://b.com' });

    const result = await commandSearch({
      allOrganizations,
      organizationId: orgAId,
      projectId: projA._id,
      workspaceId: wsA._id,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { requests: [{ id: reqA._id, organizationId: orgAId }] },
      other: { requests: [{ id: reqB._id, organizationId: orgBId }] },
    });
  });

  it('scratchpad org scopes only to its own projects, ignoring allOrganizations', async () => {
    const scratchpadOrgId = 'org_scratchpad';
    const otherOrgId = uid('org');
    const allOrganizations = [
      { id: scratchpadOrgId, name: 'Scratchpad' },
      { id: otherOrgId, name: 'Other Org' },
    ];
    const scratchProj = await services.project.create({
      _id: uid('proj'),
      name: 'ScratchProj',
      parentId: scratchpadOrgId,
    });
    const otherProj = await services.project.create({ _id: uid('proj'), name: 'OtherProj', parentId: otherOrgId });
    const scratchWs = await services.workspace.create({
      _id: uid('wrk'),
      name: 'ScratchWs',
      parentId: scratchProj._id,
      scope: 'collection',
    });
    const otherWs = await services.workspace.create({
      _id: uid('wrk'),
      name: 'OtherWs',
      parentId: otherProj._id,
      scope: 'collection',
    });
    const scratchReq = await services.request.create({
      _id: uid('r'),
      name: 'ScratchReq',
      parentId: scratchWs._id,
      url: 'http://scratch.com',
    });
    await services.request.create({ _id: uid('r'), name: 'OtherReq', parentId: otherWs._id, url: 'http://other.com' });

    const result = await commandSearch({
      allOrganizations,
      organizationId: scratchpadOrgId,
      projectId: scratchProj._id,
      workspaceId: scratchWs._id,
      filter: null,
      requestId: uid('rid'),
    });

    expect(result).toMatchObject({
      current: { requests: [{ id: scratchReq._id }] },
      other: { requests: [] },
    });
  });
});

describe('abort()', () => {
  it('does not throw when aborting an unknown requestId', async () => {
    await expect(abortCommandSearch('nonexistent-request-id')).resolves.toBeUndefined();
  });

  it('rejects with AbortError when aborted synchronously before first DB await settles', async () => {
    const { organizationId, allOrganizations } = makeOrg();
    const projId = uid('proj');
    await services.project.create({ _id: projId, name: 'P', parentId: organizationId });

    const requestId = uid('rid');
    const searchPromise = commandSearch({
      allOrganizations,
      organizationId,
      projectId: projId,
      workspaceId: null,
      filter: null,
      requestId,
    });
    // controller.abort() inside abort() is synchronous — fires the abort event
    // before any NeDB microtask can resolve, guaranteeing AbortError.
    void abortCommandSearch(requestId);

    await expect(searchPromise).rejects.toMatchObject({ name: 'AbortError' });
  });
});
