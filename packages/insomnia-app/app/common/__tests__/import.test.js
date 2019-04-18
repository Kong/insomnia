import * as models from '../../models';
import * as importUtil from '../import';
import { getAppVersion } from '../constants';
import { globalBeforeEach } from '../../__jest__/before-each';
import YAML from 'yaml';

describe('exportWorkspacesHAR() and exportRequestsHAR()', () => {
  beforeEach(globalBeforeEach);
  it('exports a single workspace and some requests only as an HTTP Archive', async () => {
    const wrk1 = await models.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1',
    });
    const req1 = await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }],
      metaSortKey: 0,
    });
    const req2 = await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk1._id,
      metaSortKey: 1,
    });
    let env1Base = await models.environment.getOrCreateForWorkspace(wrk1);
    env1Base = await models.environment.update(env1Base, {
      data: {
        envvalue: 'base1',
      },
    });
    const env1Private = await models.environment.create({
      name: 'Private',
      parentId: env1Base._id,
      data: {
        envvalue: 'private1',
      },
    });
    await models.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Private._id,
    });

    const wrk2 = await models.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2',
    });
    await models.request.create({
      _id: 'req_3',
      name: 'Request 3',
      parentId: wrk2._id,
    });

    const includePrivateDocs = true;

    // Test export whole workspace.
    const exportWorkspacesJson = await importUtil.exportWorkspacesHAR(wrk1, includePrivateDocs);
    const exportWorkspacesData = JSON.parse(exportWorkspacesJson);
    expect(exportWorkspacesData).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [{ name: 'X-Environment', value: 'private1' }],
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
    const exportRequestsJson = await importUtil.exportRequestsHAR([req1], includePrivateDocs);
    const exportRequestsData = JSON.parse(exportRequestsJson);
    expect(exportRequestsData).toMatchObject({
      log: {
        entries: [
          {
            request: {
              headers: [{ name: 'X-Environment', value: 'private1' }],
            },
            comment: req1.name,
          },
        ],
      },
    });
    expect(exportRequestsData.log.entries.length).toBe(1);
  });
  it('exports all workspaces as an HTTP Archive', async () => {
    const wrk1 = await models.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1',
    });
    const wrk2 = await models.workspace.create({
      _id: 'wrk_2',
      name: 'Workspace 2',
    });
    await models.request.create({
      _id: 'req_1',
      name: 'Request 1',
      parentId: wrk1._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }],
    });
    await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk2._id,
      headers: [{ name: 'X-Environment', value: '{{ envvalue }}' }],
    });

    let env1Base = await models.environment.getOrCreateForWorkspace(wrk1);
    env1Base = await models.environment.update(env1Base, {
      data: {
        envvalue: 'base1',
      },
    });
    const env1Public = await models.environment.create({
      name: 'Public',
      parentId: env1Base._id,
      data: {
        envvalue: 'public1',
      },
    });
    const env2Base = await models.environment.getOrCreateForWorkspace(wrk2);
    await models.environment.update(env2Base, {
      data: {
        envvalue: 'base2',
      },
    });
    const env2Private = await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: env1Base._id,
      data: {
        envvalue: 'private2',
      },
    });

    await models.workspaceMeta.create({
      parentId: wrk1._id,
      activeEnvironmentId: env1Public._id,
    });
    await models.workspaceMeta.create({
      parentId: wrk2._id,
      activeEnvironmentId: env2Private._id,
    });

    const includePrivateDocs = false;
    const json = await importUtil.exportWorkspacesHAR(null, includePrivateDocs);
    const data = JSON.parse(json);

    expect(data).toMatchObject({
      log: {
        entries: expect.arrayContaining([
          expect.objectContaining({
            request: expect.objectContaining({
              headers: [{ name: 'X-Environment', value: 'public1' }],
            }),
            comment: 'Request 1',
          }),
          expect.objectContaining({
            request: expect.objectContaining({
              headers: [{ name: 'X-Environment', value: 'base2' }],
            }),
            comment: 'Request 2',
          }),
        ]),
      },
    });
  });
});

describe('export', () => {
  beforeEach(globalBeforeEach);
  it('exports all workspaces and some requests only', async () => {
    const w = await models.workspace.create({ name: 'Workspace' });
    const jar = await models.cookieJar.getOrCreateForParentId(w._id);
    const r1 = await models.request.create({
      name: 'Request 1',
      parentId: w._id,
    });
    const f2 = await models.requestGroup.create({
      name: 'Folder 2',
      parentId: w._id,
    });
    const r2 = await models.request.create({
      name: 'Request 2',
      parentId: f2._id,
    });
    const eBase = await models.environment.getOrCreateForWorkspace(w);
    const ePub = await models.environment.create({
      name: 'Public',
      parentId: eBase._id,
    });
    await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: eBase._id,
    });

    // Test export whole workspace.
    const exportedWorkspacesJson = await importUtil.exportWorkspacesData(null, false, 'json');
    const exportedWorkspacesYaml = await importUtil.exportWorkspacesData(null, false, 'yaml');
    const exportWorkspacesDataJson = JSON.parse(exportedWorkspacesJson);
    const exportWorkspacesDataYaml = YAML.parse(exportedWorkspacesYaml);

    // Ensure JSON is the same as YAML
    expect(exportWorkspacesDataJson.resources).toEqual(exportWorkspacesDataYaml.resources);

    expect(exportWorkspacesDataJson).toMatchObject({
      _type: 'export',
      __export_format: 3,
      __export_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      resources: expect.arrayContaining([
        expect.objectContaining({ _id: w._id }),
        expect.objectContaining({ _id: eBase._id }),
        expect.objectContaining({ _id: jar._id }),
        expect.objectContaining({ _id: r1._id }),
        expect.objectContaining({ _id: f2._id }),
        expect.objectContaining({ _id: r2._id }),
        expect.objectContaining({ _id: ePub._id }),
      ]),
    });
    expect(exportWorkspacesDataJson.resources.length).toBe(7);

    // Test export some requests only.
    const exportRequestsJson = await importUtil.exportRequestsJSON([r1]);
    const exportRequestsData = JSON.parse(exportRequestsJson);
    expect(exportRequestsData).toMatchObject({
      _type: 'export',
      __export_format: 3,
      __export_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      resources: expect.arrayContaining([
        expect.objectContaining({ _id: w._id }),
        expect.objectContaining({ _id: eBase._id }),
        expect.objectContaining({ _id: jar._id }),
        expect.objectContaining({ _id: r1._id }),
        expect.objectContaining({ _id: ePub._id }),
      ]),
    });
    expect(exportRequestsData.resources.length).toBe(5);
  });
});
