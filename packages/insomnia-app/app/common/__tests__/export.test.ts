import * as models from '../../models';
import { getAppVersion } from '../constants';
import { globalBeforeEach } from '../../__jest__/before-each';
import YAML from 'yaml';
import { exportRequestsData, exportRequestsHAR, exportWorkspacesData, exportWorkspacesHAR, exportWorkspacesPostman, exportRequestsPostman } from '../export';
import * as modals from '../../ui/components/modals';

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
    const json = await exportWorkspacesHAR([], includePrivateDocs);
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
    const exportedWorkspacesJson = await exportWorkspacesData([], false, 'json');
    const exportedWorkspacesYaml = await exportWorkspacesData([], false, 'yaml');
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
          _id: spec._id,
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

describe('exportPostman', () => {
  beforeEach(globalBeforeEach);

  it('exports all workspaces and some requests only', async () => {
    modals.showAlert = jest.fn();
    // set workspace 1 data
    const w = await models.workspace.create({
      name: 'Workspace',
    });
    const r1 = await models.request.create({
      name: 'Request 1',
      parentId: w._id,
    });
    // setup for ProtoFile, Grpc Request, ProtoDirectory from older tests is skipped. Are probably legacy.
    const eBase = await models.environment.getOrCreateForParentId(w._id);
    await models.environment.create({
      name: 'Public',
      parentId: eBase._id,
    });
    await models.environment.create({
      name: 'Private',
      isPrivate: true,
      parentId: eBase._id,
    });

    // set workspace 2 data
    const w2 = await models.workspace.create({
      name: 'Workspace 2',
    });
    const f1W2 = await models.requestGroup.create({
      name: 'Folder 1',
      parentId: w2._id,
    });
    const postRequestW2 = await models.request.create({
      name: 'POST Request',
      parentId: f1W2._id,
      url: 'https://www.example.org/some/resources',
      description: '',
      method: 'POST',
      body: {
        mimeType: '',
        text: '{"bodyKey1": "bodyValue1"}',
      },
      headers: [
        { name: 'h1', value: 'h1Value' },
      ],
    });
    const postRequestFormDataW2 = await models.request.create({
      name: 'POST Request with Form Data',
      parentId: f1W2._id,
      url: 'https://www.example.org/some/resources',
      description: '',
      method: 'POST',
      body: {
        mimeType: 'multipart/form-data',
        params: [
          { name: 'formDataKey1', value: 'formDataValue1' },
        ],
      },
      headers: [
        { name: 'h1', value: 'h1Value' },
      ],
    });
    const getRequestWithParamsW2 = await models.request.create({
      name: 'GET Request with URL Params',
      parentId: f1W2._id,
      url: 'https://www.example.org/some/resources?queryParam1=queryValue1',
      parameters: [
        { name: 'queryParam2', value: 'queryValue2' },
      ],
      description: '',
      method: 'GET',
      headers: [
        { name: 'h1', value: 'h1Value' },
      ],
    });

    // Test export whole workspace.
    const fileName = 'testFile';
    const fullFileName = '/folder1/' + fileName + '.postman_collection.json';
    const exportedWorkspacesPostmanJson = await exportWorkspacesPostman([w, w2], false, fullFileName);
    const exportedWorkspacesPostmanDataJson = JSON.parse(exportedWorkspacesPostmanJson);
    expect(exportedWorkspacesPostmanDataJson).toMatchObject({
      info: expect.objectContaining({
        _postman_id: expect.anything(),
        name: fileName,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      }),
      item: expect.arrayContaining([
        expect.objectContaining({
          name: w.name,
          item: expect.arrayContaining([
            expect.objectContaining({
              name: r1.name,
              request: expect.objectContaining({
                method: r1.method,
                header: expect.arrayContaining([]),
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          name: w2.name,
          item: expect.arrayContaining([
            expect.objectContaining({
              name: f1W2.name,
              item: expect.arrayContaining([
                expect.objectContaining({
                  name: postRequestW2.name,
                  request: expect.objectContaining({
                    method: postRequestW2.method,
                    header: expect.arrayContaining([
                      expect.objectContaining({
                        key: 'h1', value: 'h1Value',
                      }),
                    ]),
                    body: expect.objectContaining({
                      mode: 'raw',
                      raw: expect.any(String),
                    }),
                    url: expect.objectContaining({
                      raw: postRequestW2.url,
                    }),
                  }),
                }),
                expect.objectContaining({
                  name: postRequestFormDataW2.name,
                  request: expect.objectContaining({
                    method: postRequestFormDataW2.method,
                    body: expect.objectContaining({
                      mode: 'formdata',
                      formdata: expect.arrayContaining([{
                        key: 'formDataKey1', value: 'formDataValue1',
                      }]),
                    }),
                    header: expect.arrayContaining([
                      expect.objectContaining({
                        key: 'h1', value: 'h1Value',
                      }),
                    ]),
                  }),
                }),
                expect.objectContaining({
                  name: getRequestWithParamsW2.name,
                  request: expect.objectContaining({
                    method: getRequestWithParamsW2.method,
                    header: expect.arrayContaining([
                      expect.objectContaining({
                        key: 'h1', value: 'h1Value',
                      }),
                    ]),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      ]),
    });

    // Test export some requests only, but from across two workspaces.
    const exportRequestsPostmanJson = await exportRequestsPostman([r1, postRequestW2], false, fullFileName);
    const exportRequestsPostmanDataJson = JSON.parse(exportRequestsPostmanJson);
    expect(exportRequestsPostmanDataJson).toMatchObject({
      info: expect.objectContaining({
        _postman_id: expect.anything(),
        name: fileName,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      }),
      item: expect.arrayContaining([
        expect.objectContaining({
          name: w.name,
          item: expect.arrayContaining([
            expect.objectContaining({
              name: r1.name,
              request: expect.objectContaining({
                method: r1.method,
                header: expect.arrayContaining([]),
              }),
            }),
          ]),
        }),
        expect.objectContaining({
          name: w2.name,
          item: expect.arrayContaining([
            expect.objectContaining({
              name: f1W2.name,
              item: expect.arrayContaining([
                expect.objectContaining({
                  name: postRequestW2.name,
                  request: expect.objectContaining({
                    method: postRequestW2.method,
                    header: expect.arrayContaining([]),
                  }),
                }),
              ]),
            }),
          ]),
        }),
      ]),
    });

    // Test export some requests only, but from a single workspaces (intermediary workspace folder should not get included).
    const exportRequestsSingleWSPostmanJson2 = await exportRequestsPostman([r1], false, fullFileName);
    const exportRequestsSingleWSPostmanDataJson2 = JSON.parse(exportRequestsSingleWSPostmanJson2);
    expect(exportRequestsSingleWSPostmanDataJson2).toMatchObject({
      info: expect.objectContaining({
        _postman_id: expect.anything(),
        name: fileName,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      }),
      item: expect.arrayContaining([
        expect.objectContaining({
          name: r1.name,
          request: expect.objectContaining({
            method: r1.method,
            header: expect.arrayContaining([]),
          }),
        }),
      ]),
    });
  });
});
