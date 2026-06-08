import { exportRequestsHAR, exportWorkspacesHAR } from 'insomnia/src/main/har';
import { database as db, services } from 'insomnia-data';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('~/network/network-adapter', () => ({
  getTimelinePath: () => Promise.resolve(''),
  appendToTimelineOnError: () => Promise.resolve(),
  appendTimelineLines: () => Promise.resolve(),
  getAuthHeader: () => Promise.resolve(),
  executeCurlRequest: () => Promise.resolve({}),
  runScript: () => Promise.resolve({}),
  applyRequestHooks: (request: any) => Promise.resolve(request),
  applyResponseHooks: (response: any) => Promise.resolve(response),
}));

// @vitest-environment jsdom
describe('exportWorkspacesHAR() and exportRequestsHAR()', () => {
  beforeEach(async () => {
    await services.settings.getOrCreate();
  });

  it('exports a single workspace and some requests only as an HTTP Archive', async () => {
    const wrk1 = await services.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1',
    });
    const req1 = await services.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [
        {
          name: 'X-Environment',
          value: '{{ envvalue }}',
        },
      ],
      metaSortKey: 0,
    });
    const req2 = await services.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk1._id,
      metaSortKey: 1,
    });
    let env1Base = await services.environment.getOrCreateForParentId(wrk1._id);
    env1Base = await services.environment.update(env1Base, {
      data: {
        envvalue: 'base1',
      },
    });
    const env1Private = await services.environment.create({
      name: 'Private',
      parentId: env1Base._id,
      data: {
        envvalue: 'private1',
      },
    });
    await services.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Private._id,
    });
    const wrk2 = await services.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2',
    });
    await services.request.create({
      _id: 'req_3',
      name: 'Request 3',
      parentId: wrk2._id,
    });
    const includePrivateDocs = true;
    // Test export whole workspace.
    const exportWorkspacesJson = await exportWorkspacesHAR([wrk1], includePrivateDocs);
    const exportWorkspacesData = JSON.parse(exportWorkspacesJson);
    expect(exportWorkspacesData).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [
                {
                  name: 'X-Environment',
                  value: 'private1',
                },
              ],
            },
            comment: req1.name,
          },
          {
            comment: req2.name,
          },
        ],
      },
    });
    expect(exportWorkspacesData.log.entries.length).toBe(2);
    // Test export some requests only.
    const exportRequestsJson = await exportRequestsHAR([req1], includePrivateDocs);
    const exportRequestsData = JSON.parse(exportRequestsJson);
    expect(exportRequestsData).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [
                {
                  name: 'X-Environment',
                  value: 'private1',
                },
              ],
            },
            comment: req1.name,
          },
        ],
      },
    });
    expect(exportRequestsData.log.entries.length).toBe(1);
  });

  it('exports all workspaces as an HTTP Archive', async () => {
    await db.init({ inMemoryOnly: true }, true);

    const wrk1 = await services.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1',
    });
    const wrk2 = await services.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2',
    });
    await services.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [
        {
          name: 'X-Environment',
          value: '{{ envvalue }}',
        },
      ],
    });
    await services.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk2._id,
      headers: [
        {
          name: 'X-Environment',
          value: '{{ envvalue }}',
        },
      ],
    });
    let env1Base = await services.environment.getOrCreateForParentId(wrk1._id);
    env1Base = await services.environment.update(env1Base, {
      data: {
        envvalue: 'base1',
      },
    });
    const env1Public = await services.environment.create({
      name: 'Public',
      parentId: env1Base._id,
      data: {
        envvalue: 'public1',
      },
    });
    const env2Base = await services.environment.getOrCreateForParentId(wrk2._id);
    await services.environment.update(env2Base, {
      data: {
        envvalue: 'base2',
      },
    });
    const env2Private = await services.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: env1Base._id,
      data: {
        envvalue: 'private2',
      },
    });
    await services.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Public._id,
    });
    await services.workspaceMeta.create({
      parentId: wrk2._id,
      activeEnvironmentId: env2Private._id,
    });
    const includePrivateDocs = false;
    const json = await exportWorkspacesHAR([wrk1, wrk2], includePrivateDocs);
    const data = JSON.parse(json);
    expect(data).toMatchObject({
      log: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            request: expect.objectContaining({
              headers: [
                {
                  name: 'X-Environment',
                  value: 'public1',
                },
              ],
            }),
            comment: 'Request 1',
          }),
          expect.objectContaining({
            request: expect.objectContaining({
              headers: [
                {
                  name: 'X-Environment',
                  value: 'base2',
                },
              ],
            }),
            comment: 'Request 2',
          }),
        ]),
      },
    });
  });
});
