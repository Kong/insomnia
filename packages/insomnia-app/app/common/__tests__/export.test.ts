import YAML from 'yaml';

import { globalBeforeEach } from '../../__jest__/before-each';
import * as models from '../../models';
import { getAppVersion } from '../constants';
import { exportRequestsData, exportRequestsHAR, exportWorkspacesData, exportWorkspacesHAR } from '../export';

describe('exportWorkspacesHAR() and exportRequestsHAR()', () => {
  beforeEach(async () => {
    await globalBeforeEach();
    await models.project.all();
  });

  it('exports a single workspace and some requests only as an HTTP Archive', async () => {
    const wrk1 = await models.workspace.create({
      _id: 'wrk_1',
      name: 'Workspace 1',
    });
    const req1 = await models.request.create({
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
    const req2 = await models.request.create({
      _id: 'req_2',
      name: 'Request 2',
      parentId: wrk1._id,
      metaSortKey: 1,
    });
    let env1Base = await models.environment.getOrCreateForParentId(wrk1._id);
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
      headers: [
        {
          name: 'X-Environment',
          value: '{{ envvalue }}',
        },
      ],
    });
    await models.request.create({
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
    let env1Base = await models.environment.getOrCreateForParentId(wrk1._id);
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
    const env2Base = await models.environment.getOrCreateForParentId(wrk2._id);
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

describe('export', () => {
  beforeEach(globalBeforeEach);

  it('exports all workspaces and some requests only', async () => {
    const w = await models.workspace.create({
      name: 'Workspace',
    });
    const spec = await models.apiSpec.getByParentId(w._id); // Created by workspace migration

    const jar = await models.cookieJar.getOrCreateForParentId(w._id);
    const r1 = await models.request.create({
      name: 'Request 1',
      parentId: w._id,
    });
    const pf1 = await models.protoFile.create({
      name: 'ProtoFile 1',
      parentId: w._id,
    });
    const gr1 = await models.grpcRequest.create({
      name: 'Grpc Request 1',
      parentId: w._id,
      protoFileId: pf1._id,
    });
    const pd = await models.protoDirectory.create({
      name: 'ProtoDirectory 1',
      parentId: w._id,
    });
    const pf2 = await models.protoFile.create({
      name: 'ProtoFile 2',
      parentId: pd._id,
    });
    const gr2 = await models.grpcRequest.create({
      name: 'Grpc Request 2',
      parentId: w._id,
      protoFileId: pf2._id,
    });
    const f2 = await models.requestGroup.create({
      name: 'Folder 2',
      parentId: w._id,
    });
    const r2 = await models.request.create({
      name: 'Request 2',
      parentId: f2._id,
    });
    const eBase = await models.environment.getOrCreateForParentId(w._id);
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
    const exportedWorkspacesJson = await exportWorkspacesData([w], false, 'json');
    const exportedWorkspacesYaml = await exportWorkspacesData([w], false, 'yaml');
    const exportWorkspacesDataJson = JSON.parse(exportedWorkspacesJson);
    const exportWorkspacesDataYaml = YAML.parse(exportedWorkspacesYaml);
    // Ensure JSON is the same as YAML
    expect(exportWorkspacesDataJson.resources).toEqual(exportWorkspacesDataYaml.resources);
    expect(exportWorkspacesDataJson).toMatchObject({
      _type: 'export',
      __export_format: 4,
      __export_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      resources: expect.arrayContaining([
        expect.objectContaining({
          _id: w._id,
        }),
        expect.objectContaining({
          _id: spec?._id,
        }),
        expect.objectContaining({
          _id: eBase._id,
        }),
        expect.objectContaining({
          _id: jar._id,
        }),
        expect.objectContaining({
          _id: r1._id,
        }),
        expect.objectContaining({
          _id: f2._id,
        }),
        expect.objectContaining({
          _id: r2._id,
        }),
        expect.objectContaining({
          _id: ePub._id,
        }),
        expect.objectContaining({
          _id: gr1._id,
        }),
        expect.objectContaining({
          _id: pd._id,
        }),
        expect.objectContaining({
          _id: pf1._id,
        }),
        expect.objectContaining({
          _id: gr2._id,
        }),
        expect.objectContaining({
          _id: pf2._id,
        }),
      ]),
    });
    expect(exportWorkspacesDataJson.resources.length).toBe(13);
    // Test export some requests only.
    const exportRequestsJson = await exportRequestsData([r1, gr1], false, 'json');
    const exportRequestsYaml = await exportRequestsData([r1, gr1], false, 'yaml');
    const exportRequestsDataJSON = JSON.parse(exportRequestsJson);
    const exportRequestsDataYAML = YAML.parse(exportRequestsYaml);
    expect(exportRequestsDataJSON).toMatchObject({
      _type: 'export',
      __export_format: 4,
      __export_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      resources: expect.arrayContaining([
        expect.objectContaining({
          _id: w._id,
        }),
        expect.objectContaining({
          _id: eBase._id,
        }),
        expect.objectContaining({
          _id: jar._id,
        }),
        expect.objectContaining({
          _id: r1._id,
        }),
        expect.objectContaining({
          _id: ePub._id,
        }),
        expect.objectContaining({
          _id: gr1._id,
        }),
        expect.objectContaining({
          _id: pf1._id,
        }),
        expect.objectContaining({
          _id: pf2._id,
        }),
      ]),
    });
    expect(exportRequestsDataJSON.resources.length).toBe(10);
    expect(exportRequestsDataYAML.resources.length).toBe(10);
    // Ensure JSON and YAML are the same
    expect(exportRequestsDataJSON.resources).toEqual(exportRequestsDataYAML.resources);
  });

  it('exports correct models', async () => {
    const w = await models.workspace.create({
      name: 'Workspace',
    });
    const spec = await models.apiSpec.getOrCreateForParentId(w._id, {
      type: 'yaml',
      contents: 'openapi: "3.0.0"',
    });
    const jar = await models.cookieJar.getOrCreateForParentId(w._id);
    const pd = await models.protoDirectory.create({
      name: 'ProtoDirectory 1',
      parentId: w._id,
    });
    const pf1 = await models.protoFile.create({
      name: 'ProtoFile 1',
      parentId: w._id,
    });
    const pf2 = await models.protoFile.create({
      name: 'ProtoFile 2',
      parentId: pd._id,
    });
    const r1 = await models.request.create({
      name: 'Request 1',
      parentId: w._id,
    });
    const gr1 = await models.grpcRequest.create({
      name: 'Grpc Request 1',
      parentId: w._id,
      protoFileId: pf1._id,
    });
    const f2 = await models.requestGroup.create({
      name: 'Folder 2',
      parentId: w._id,
    });
    const r2 = await models.request.create({
      name: 'Request 2',
      parentId: f2._id,
    });
    const gr2 = await models.grpcRequest.create({
      name: 'Grpc Request 2',
      parentId: f2._id,
      protoFileId: pf2._id,
    });
    const uts1 = await models.unitTestSuite.create({
      name: 'Unit Test Suite One',
      parentId: w._id,
    });
    const ut1 = await models.unitTest.create({
      name: 'Unit Test One',
      parentId: uts1._id,
    });
    const eBase = await models.environment.getOrCreateForParentId(w._id);
    const ePub = await models.environment.create({
      name: 'Public',
      parentId: eBase._id,
    });
    await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: eBase._id,
    });
    const result = await exportWorkspacesData([w], false, 'json');
    expect(JSON.parse(result)).toEqual({
      _type: 'export',
      __export_format: 4,
      __export_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/),
      __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
      resources: expect.arrayContaining([
        expect.objectContaining({
          _id: w._id,
        }),
        expect.objectContaining({
          _id: eBase._id,
        }),
        expect.objectContaining({
          _id: jar._id,
        }),
        expect.objectContaining({
          _id: pd._id,
        }),
        expect.objectContaining({
          _id: pf1._id,
        }),
        expect.objectContaining({
          _id: pf2._id,
        }),
        expect.objectContaining({
          _id: r1._id,
        }),
        expect.objectContaining({
          _id: r2._id,
        }),
        expect.objectContaining({
          _id: gr1._id,
        }),
        expect.objectContaining({
          _id: gr2._id,
        }),
        expect.objectContaining({
          _id: uts1._id,
        }),
        expect.objectContaining({
          _id: ut1._id,
        }),
        expect.objectContaining({
          _id: ePub._id,
        }),
        expect.objectContaining({
          _id: spec._id,
        }),
      ]),
    });
  });
});
