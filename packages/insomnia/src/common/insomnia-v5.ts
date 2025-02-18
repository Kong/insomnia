import { parse, stringify } from 'yaml';

import * as models from '../models';
import type { ApiSpec } from '../models/api-spec';
import type { CookieJar } from '../models/cookie-jar';
import type { Environment } from '../models/environment';
import type { GrpcRequest } from '../models/grpc-request';
import type { MockRoute } from '../models/mock-route';
import type { MockServer } from '../models/mock-server';
import type { Request } from '../models/request';
import type { RequestGroup } from '../models/request-group';
import type { UnitTest } from '../models/unit-test';
import type { UnitTestSuite } from '../models/unit-test-suite';
import type { WebSocketRequest } from '../models/websocket-request';
import type { Workspace, WorkspaceScope } from '../models/workspace';
import { EXPORT_TYPE_API_SPEC, EXPORT_TYPE_COOKIE_JAR, EXPORT_TYPE_ENVIRONMENT, EXPORT_TYPE_GRPC_REQUEST, EXPORT_TYPE_MOCK_ROUTE, EXPORT_TYPE_MOCK_SERVER, EXPORT_TYPE_REQUEST, EXPORT_TYPE_REQUEST_GROUP, EXPORT_TYPE_UNIT_TEST, EXPORT_TYPE_UNIT_TEST_SUITE, EXPORT_TYPE_WEBSOCKET_REQUEST, EXPORT_TYPE_WORKSPACE } from './constants';
import { database } from './database';
import { type InsomniaFile, insomniaFileSchema, type Meta, WebsocketRequestSchema, type Z_GRPCRequest, type Z_Request, type Z_RequestGroup, type Z_WebsocketRequest } from './import-v5-parser';

type WithExportType<T extends models.BaseModel> = T & { _type: string };

function filterEmptyValue(value: string | number | boolean | null | undefined) {
  return value !== null && value !== undefined && value !== '' && !(typeof value === 'object' && Object.keys(value).length === 0);
}

function removeEmptyFields(data: any): any {
  if (Array.isArray(data)) {
    const list = data.map(removeEmptyFields).filter(filterEmptyValue);
    return list.length > 0 ? list : undefined;
  } else if (data && typeof data === 'object') {
    const object = Object.fromEntries(
      Object.entries(data)
        .map(([key, value]) => [key, removeEmptyFields(value)])
        .filter(([, value]) => value !== undefined),
    );

    return Object.keys(object).length > 0 ? object : undefined;
  }

  return filterEmptyValue(data) ? data : undefined;
}

function mapMetaToInsomniaMeta(meta: Meta): {
  _id: string;
  created: number;
  modified: number;
  isPrivate: boolean;
  description: string;
  metaSortKey: number;
} {
  return {
    _id: meta.id,
    created: meta.created || Date.now(),
    modified: meta.modified || Date.now(),
    isPrivate: meta.isPrivate || false,
    description: meta.description || '',
    metaSortKey: meta.sortKey || 0,
  };
}

function getScope(file: InsomniaFile): WorkspaceScope {
  if (file.type === 'collection.insomnia.rest/5.0') {
    return 'collection';
  } else if (file.type === 'environment.insomnia.rest/5.0') {
    return 'environment';
  } else if (file.type === 'spec.insomnia.rest/5.0') {
    return 'design';
  } else {
    return 'mock-server';
  }
}

function getWorkspace(file: InsomniaFile): WithExportType<Workspace> {
  return {
    ...mapMetaToInsomniaMeta(file.meta || {
      id: '__WORKSPACE_ID__',
    }),
    type: 'Workspace',
    _type: EXPORT_TYPE_WORKSPACE,
    name: file.name || 'Imported Collection',
    parentId: '',
    scope: getScope(file),
  };
}

function getEnvironments(file: InsomniaFile): Environment[] {
  if ('environments' in file && file.environments) {
    const baseEnvironment: WithExportType<Environment> = {
      ...mapMetaToInsomniaMeta(file.environments.meta || {
        id: '__ENVIRONMENT_ID__',
      }),
      type: 'Environment',
      _type: EXPORT_TYPE_ENVIRONMENT,
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      color: file.environments.color || null,
      data: file.environments.data as Record<string, any> || {},
      dataPropertyOrder: file.environments.dataPropertyOrder as Record<string, any> || undefined,
      name: file.environments.name || 'Base Environment',
    };

    const subEnvironments: WithExportType<Environment>[] = file.environments.subEnvironments?.map((environment, index) => ({
      ...mapMetaToInsomniaMeta(environment.meta || {
        id: '__ENVIRONMENT_ID__',
      }),
      type: 'Environment',
      _type: EXPORT_TYPE_ENVIRONMENT,
      color: environment.color || null,
      data: environment.data as Record<string, any> || {},
      dataPropertyOrder: environment.dataPropertyOrder as Record<string, any> || undefined,
      name: environment.name || `Environment ${index}`,
      parentId: baseEnvironment._id,
    })) || [];

    return [baseEnvironment, ...subEnvironments];
  }

  return [];
}

function getCookieJar(file: InsomniaFile): [CookieJar] | [] {
  if ('cookieJar' in file && file.cookieJar) {
    const cookieJar: WithExportType<CookieJar> = {
      ...mapMetaToInsomniaMeta(file.cookieJar.meta || {
        id: '__COOKIE_JAR_ID__',
      }),
      type: 'CookieJar',
      _type: EXPORT_TYPE_COOKIE_JAR,
      name: file.cookieJar.name || 'Imported Cookie Jar',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      cookies: file.cookieJar.cookies || [],
    };

    return [cookieJar];
  }

  return [];
}

function getApiSpec(file: InsomniaFile): [WithExportType<ApiSpec>] | [] {
  if ('spec' in file && file.spec) {
    return [{
      ...mapMetaToInsomniaMeta(file.spec.meta || {
        id: '__API_SPEC_ID__',
      }),
      type: 'ApiSpec',
      name: file.name || 'Api Spec',
      _type: EXPORT_TYPE_API_SPEC,
      fileName: 'file' in file.spec ? file.spec.file : '',
      contentType: 'json',
      contents: 'contents' in file.spec && file.spec.contents ? JSON.stringify(file.spec.contents) : '',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
    }];
  }

  return [];
}

function getMockServer(file: InsomniaFile): WithExportType<MockServer> {
  if (file.type === 'mock.insomnia.rest/5.0') {
    return {
      ...mapMetaToInsomniaMeta(file.meta || {
        id: '__MOCK_SERVER_ID__',
      }),
      type: 'MockServer',
      _type: EXPORT_TYPE_MOCK_SERVER,
      name: file.name || 'Imported Mock Server',
      parentId: file.meta?.id || '',
      url: file.url || '',
      useInsomniaCloud: file.useInsomniaCloud || false,
    };
  }

  throw new Error('No Mock Server found');
}

function getMockRoutes(file: InsomniaFile): WithExportType<MockRoute>[] {
  if (file.type === 'mock.insomnia.rest/5.0') {
    return file.routes?.map(mock => ({
      ...mapMetaToInsomniaMeta(mock.meta || {
        id: '__MOCK_ROUTE_ID__',
      }),
      type: 'MockRoute',
      _type: EXPORT_TYPE_MOCK_ROUTE,
      name: mock.name || 'Imported Mock Route',
      parentId: file.meta?.id || '',
      body: mock.body,
      headers: mock.headers || [],
      method: mock.method,
      mimeType: mock.mimeType,
      statusCode: mock.statusCode,
      statusText: mock.statusText,
    })) || [];
  }

  return [];
}

function getTestSuites(file: InsomniaFile): (UnitTestSuite | UnitTest)[] {
  if (file.type === 'spec.insomnia.rest/5.0') {
    const resources: (UnitTestSuite | UnitTest)[] = [];

    file.testSuites?.forEach((testSuite, index) => {
      const suite: WithExportType<UnitTestSuite> = {
        ...mapMetaToInsomniaMeta(testSuite.meta || {
          id: '__UNIT_TEST_SUITE_ID__',
        }),
        type: 'UnitTestSuite',
        _type: EXPORT_TYPE_UNIT_TEST_SUITE,
        name: testSuite.name || 'Imported Test Suite',
        parentId: file.meta?.id || '__WORKSPACE_ID__',
        metaSortKey: testSuite.meta?.sortKey ?? index,
      };

      resources.push(suite);

      const tests: WithExportType<UnitTest>[] = testSuite.tests?.map((test, index) => ({
        ...mapMetaToInsomniaMeta(test.meta || {
          id: '__UNIT_TEST_ID__',
        }),
        type: 'UnitTest',
        _type: EXPORT_TYPE_UNIT_TEST,
        name: test.name || 'Imported Test',
        parentId: suite._id,
        requestId: test.requestId,
        code: test.code,
        metaSortKey: test.meta?.sortKey ?? index,
      })) || [];

      resources.push(...tests);
    });

    return resources;
  }

  return [];
}

function getCollection(file: InsomniaFile): (Request | WebSocketRequest | GrpcRequest | RequestGroup)[] {
  if (file.type === 'collection.insomnia.rest/5.0' || file.type === 'spec.insomnia.rest/5.0') {
    const resources: (Request | WebSocketRequest | GrpcRequest | RequestGroup)[] = [];

    function walkCollection(collection: Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'], parentId: string) {
      collection?.forEach(item => {
        if ('children' in item) {
          const requestGroup: WithExportType<RequestGroup> = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__REQUEST_GROUP_ID__',
            }),
            type: 'RequestGroup',
            _type: EXPORT_TYPE_REQUEST_GROUP,
            name: item.name || 'Imported Folder',
            parentId,
            preRequestScript: item.scripts?.preRequest || '',
            afterResponseScript: item.scripts?.afterResponse || '',
            authentication: item.authentication || {},
            environment: item.environment as Record<string, any> || {},
            // 🚧 WARNING 🚧 If we set the order to an empty object instead of undefined it will remove the environment from the folder due to filtering logic (related to json-order)
            environmentPropertyOrder: item.environmentPropertyOrder as Record<string, any> || undefined,
          };

          resources.push(requestGroup);

          walkCollection(item.children, requestGroup._id);
        } else if ('method' in item) {
          const request: WithExportType<Request> = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__REQUEST_ID__',
            }),
            type: 'Request',
            _type: EXPORT_TYPE_REQUEST,
            name: item.name || 'Imported Request',
            parentId,
            url: item.url,
            method: item.method,
            body: item.body || {},
            parameters: item.parameters || [],
            headers: item.headers || [],
            authentication: item.authentication || {},
            preRequestScript: item.scripts?.preRequest || '',
            settingDisableRenderRequestBody: !item.settings.renderRequestBody,
            settingEncodeUrl: item.settings.encodeUrl,
            settingFollowRedirects: item.settings.followRedirects,
            settingSendCookies: item.settings.cookies.send,
            settingStoreCookies: item.settings.cookies.store,
            settingRebuildPath: item.settings.rebuildPath,
            afterResponseScript: item.scripts?.afterResponse || '',
            pathParameters: item.pathParameters || [],
            metaSortKey: item.meta?.sortKey ?? 0,
          };

          resources.push(request);
        } else if ('reflectionApi' in item) {
          const grpcRequest: WithExportType<GrpcRequest> = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__GRPC_REQUEST_ID__',
            }),
            type: 'GrpcRequest',
            _type: EXPORT_TYPE_GRPC_REQUEST,
            name: item.name || 'Imported gRPC Request',
            parentId,
            url: item.url,
            protoMethodName: item.protoMethodName,
            metadata: item.metadata || [],
            body: item.body || {},
            metaSortKey: item.meta?.sortKey ?? 0,
            reflectionApi: item.reflectionApi || {
              apiKey: '',
              enabled: false,
              module: '',
              url: '',
            },
            protoFileId: item.protoFileId || '',
          };

          resources.push(grpcRequest);
        } else {
          const wbRequest = WebsocketRequestSchema.safeParse(item);
          if (wbRequest.success) {
            const data = wbRequest.data;
            const websocketRequest: WithExportType<WebSocketRequest> = {
              ...mapMetaToInsomniaMeta(data.meta || {
                id: '__WEBSOCKET_REQUEST_ID__',
              }),
              type: 'WebSocketRequest',
              _type: EXPORT_TYPE_WEBSOCKET_REQUEST,
              name: item.name || 'Imported WebSocket Request',
              parentId,
              url: data.url,
              authentication: data.authentication || {},
              metaSortKey: item.meta?.sortKey ?? 0,
              headers: data.headers || [],
              parameters: data.parameters || [],
              settingEncodeUrl: data.settings.encodeUrl,
              settingFollowRedirects: data.settings.followRedirects,
              settingSendCookies: data.settings.cookies.send,
              settingStoreCookies: data.settings.cookies.store,
              pathParameters: data.pathParameters || [],
            };

            resources.push(websocketRequest);
          }
        }
      });
    }

    walkCollection(file.collection, file.meta?.id || '__WORKSPACE_ID__');

    return resources;
  }

  return [];
}

export function importInsomniaV5Data(rawData: string) {
  try {
    const file = insomniaFileSchema.parse(parse(rawData));

    if (file.type === 'collection.insomnia.rest/5.0') {
      return [
        getWorkspace(file),
        ...getEnvironments(file),
        ...getCookieJar(file),
        ...getCollection(file),
      ];
    }

    if (file.type === 'spec.insomnia.rest/5.0') {
      return [
        getWorkspace(file),
        ...getEnvironments(file),
        ...getCookieJar(file),
        ...getCollection(file),
        ...getApiSpec(file),
        ...getTestSuites(file),
      ];
    }

    if (file.type === 'environment.insomnia.rest/5.0') {
      return [
        getWorkspace(file),
        ...getEnvironments(file),
      ];
    }

    return [
      getWorkspace(file),
      getMockServer(file),
      ...getMockRoutes(file),
    ];
  } catch (err) {
    console.error('Failed to import Insomnia v5 data', err);
    return [];
  }
};

export async function getInsomniaV5DataExport(workspaceId: string) {
  const workspace = await models.workspace.getById(workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found');
  }

  const workspaceDescendants = await database.withDescendants(workspace);

  const exportableTypes = Object.values(models.MODELS_BY_EXPORT_TYPE).map(model => model.type);

  const exportableResources = workspaceDescendants.filter(resource => {
    if (exportableTypes.includes(resource.type)) {
      return true;
    }

    return false;
  });

  function getCollectionFromResources(resources: (Request | RequestGroup | WebSocketRequest | GrpcRequest)[], parentId: string): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'] {
    const collection: Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'] = [];

    resources.filter(resource => resource.parentId === parentId).forEach(resource => {
      if (models.request.isRequest(resource)) {
        const request: Z_Request = {
          url: resource.url,
          name: resource.name,
          meta: {
            id: resource._id,
            created: resource.created,
            modified: resource.modified,
            isPrivate: resource.isPrivate,
            description: resource.description,
            sortKey: resource.metaSortKey,
          },
          method: resource.method,
          body: resource.body,
          parameters: resource.parameters,
          headers: resource.headers,
          authentication: resource.authentication,
          scripts: {
            preRequest: resource.preRequestScript,
            afterResponse: resource.afterResponseScript,
          },
          settings: {
            renderRequestBody: !resource.settingDisableRenderRequestBody,
            encodeUrl: resource.settingEncodeUrl,
            followRedirects: resource.settingFollowRedirects,
            cookies: {
              send: resource.settingSendCookies,
              store: resource.settingStoreCookies,
            },
            rebuildPath: resource.settingRebuildPath,
          },
          pathParameters: resource.pathParameters,
        };
        collection.push(request);
      } else if (models.requestGroup.isRequestGroup(resource)) {
        const requestGroup: Z_RequestGroup = {
          name: resource.name,
          meta: {
            id: resource._id,
            created: resource.created,
            modified: resource.modified,
            isPrivate: resource.isPrivate,
            sortKey: resource.metaSortKey,
            description: resource.description,
          },
          children: getCollectionFromResources(resources, resource._id),
          scripts: {
            afterResponse: resource.afterResponseScript,
            preRequest: resource.preRequestScript,
          },
          authentication: resource.authentication,
          environment: resource.environment,
          environmentPropertyOrder: resource.environmentPropertyOrder,
          headers: resource.headers,
        };
        collection.push(requestGroup);
      } else if (models.webSocketRequest.isWebSocketRequest(resource)) {
        const webSocketRequest: Z_WebsocketRequest = {
          url: resource.url,
          name: resource.name,
          meta: {
            id: resource._id,
            created: resource.created,
            modified: resource.modified,
            isPrivate: resource.isPrivate,
            description: resource.description,
            sortKey: resource.metaSortKey,
          },
          settings: {
            encodeUrl: resource.settingEncodeUrl,
            followRedirects: resource.settingFollowRedirects,
            cookies: {
              send: resource.settingSendCookies,
              store: resource.settingStoreCookies,
            },
          },
          authentication: resource.authentication,
          headers: resource.headers,
          parameters: resource.parameters,
          pathParameters: resource.pathParameters,
        };
        collection.push(webSocketRequest);
      } else if (models.grpcRequest.isGrpcRequest(resource)) {
        const grpcRequest: Z_GRPCRequest = {
          url: resource.url,
          name: resource.name,
          meta: {
            id: resource._id,
            created: resource.created,
            modified: resource.modified,
            isPrivate: resource.isPrivate,
            sortKey: resource.metaSortKey,
            description: resource.description,
          },
          body: resource.body,
          metadata: resource.metadata,
          protoFileId: resource.protoFileId,
          protoMethodName: resource.protoMethodName,
          reflectionApi: resource.reflectionApi,
        };

        collection.push(grpcRequest);
      }
    });

    return collection;
  }

  function getEnvironmentsFromResources(resources: Environment[]): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['environments'] {
    const baseEnvironment = resources.find(environment => environment.parentId.startsWith('wrk_'));
    if (!baseEnvironment) {
      throw new Error('Base environment not found');
    }

    const subEnvironments = resources.filter(environment => environment.parentId === baseEnvironment?._id);

    return {
      name: baseEnvironment.name,
      meta: {
        id: baseEnvironment._id,
        created: baseEnvironment.created,
        modified: baseEnvironment.modified,
        isPrivate: baseEnvironment.isPrivate,
      },
      data: baseEnvironment.data,
      color: baseEnvironment.color,
      subEnvironments: subEnvironments.map(subEnvironment => ({
        name: subEnvironment.name,
        meta: {
          id: subEnvironment._id,
          created: subEnvironment.created,
          modified: subEnvironment.modified,
          isPrivate: subEnvironment.isPrivate,
          sortKey: subEnvironment.metaSortKey,
        },
        data: subEnvironment.data,
        color: subEnvironment.color,
      })),
    };
  }

  function getCookieJarFromResources(resources: CookieJar[]): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['cookieJar'] {
    return resources.map(resource => ({
      name: resource.name,
      meta: {
        id: resource._id,
        created: resource.created,
        modified: resource.modified,
        isPrivate: resource.isPrivate,
      },
      cookies: resource.cookies.map(cookie => ({
        ...cookie,
        expires: cookie.expires ? new Date(cookie.expires) : null,
      })),
    }))[0];
  }

  function getTestSuitesFromResources(resources: (UnitTestSuite | UnitTest)[]): Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['testSuites'] {
    const testSuites: Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['testSuites'] = [];

    resources.filter(models.unitTestSuite.isUnitTestSuite).forEach(testSuite => {
      const tests = resources.filter(models.unitTest.isUnitTest).filter(test => test.parentId === testSuite._id);

      testSuites.push({
        name: testSuite.name,
        meta: {
          id: testSuite._id,
          created: testSuite.created,
          modified: testSuite.modified,
          isPrivate: testSuite.isPrivate,
          sortKey: testSuite.metaSortKey,
        },
        tests: tests.map(test => ({
          name: test.name,
          meta: {
            id: test._id,
            created: test.created,
            modified: test.modified,
            isPrivate: test.isPrivate,
            sortKey: test.metaSortKey,
          },
          requestId: test.requestId,
          code: test.code,
        })),
      });
    });

    return testSuites;
  }

  function getSpecFromResources(resources: ApiSpec[]): Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['spec'] {
    const spec = resources[0];
    const parser = spec.contentType === 'json' ? JSON.parse : parse;
    return {
      // @TODO In the future we want to support also reading from a file like this: file: resources[0].fileName,
      contents: parser(resources[0].contents),
      meta: {
        id: spec._id,
        created: spec.created,
        modified: spec.modified,
        isPrivate: spec.isPrivate,
      },
    };
  }

  function getRoutesFromResources(resources: MockRoute[]): Extract<InsomniaFile, { type: 'mock.insomnia.rest/5.0' }>['routes'] {
    return resources.map(resource => ({
      name: resource.name,
      meta: {
        id: resource._id,
        created: resource.created,
        modified: resource.modified,
        isPrivate: resource.isPrivate,
      },
      body: resource.body,
      headers: resource.headers,
      method: resource.method,
      mimeType: resource.mimeType,
      statusCode: resource.statusCode,
      statusText: resource.statusText,
    }));
  }

  if (workspace.scope === 'collection') {
    const collection: InsomniaFile = {
      type: 'collection.insomnia.rest/5.0',
      name: workspace.name,
      meta: {
        id: workspace._id,
        created: workspace.created,
        modified: workspace.modified,
        isPrivate: workspace.isPrivate,
        description: workspace.description,
      },
      collection: getCollectionFromResources(exportableResources.filter(resource => models.requestGroup.isRequestGroup(resource) || models.request.isRequest(resource) || models.webSocketRequest.isWebSocketRequest(resource) || models.grpcRequest.isGrpcRequest(resource)), workspace._id),
      cookieJar: getCookieJarFromResources(exportableResources.filter(models.cookieJar.isCookieJar)),
      environments: getEnvironmentsFromResources(exportableResources.filter(models.environment.isEnvironment)),
    };

    return stringify(removeEmptyFields(collection));
  } else if (workspace.scope === 'design') {
    const spec: InsomniaFile = {
      type: 'spec.insomnia.rest/5.0',
      name: workspace.name,
      meta: {
        id: workspace._id,
        created: workspace.created,
        modified: workspace.modified,
        isPrivate: workspace.isPrivate,
        description: workspace.description,
      },
      collection: getCollectionFromResources(exportableResources.filter(resource => models.requestGroup.isRequestGroup(resource) || models.request.isRequest(resource) || models.webSocketRequest.isWebSocketRequest(resource) || models.grpcRequest.isGrpcRequest(resource)), workspace._id),
      cookieJar: getCookieJarFromResources(exportableResources.filter(models.cookieJar.isCookieJar)),
      environments: getEnvironmentsFromResources(exportableResources.filter(models.environment.isEnvironment)),
      spec: getSpecFromResources(exportableResources.filter(models.apiSpec.isApiSpec)),
      testSuites: getTestSuitesFromResources(exportableResources.filter(resource => models.unitTestSuite.isUnitTestSuite(resource) || models.unitTest.isUnitTest(resource))),
    };

    return stringify(removeEmptyFields(spec));
  } else if (workspace.scope === 'environment') {
    const environment: InsomniaFile = {
      type: 'environment.insomnia.rest/5.0',
      name: workspace.name,
      meta: {
        id: workspace._id,
        created: workspace.created,
        modified: workspace.modified,
        isPrivate: workspace.isPrivate,
        description: workspace.description,
      },
      environments: getEnvironmentsFromResources(exportableResources.filter(models.environment.isEnvironment)),
    };

    return stringify(removeEmptyFields(environment));
  } else if (workspace.scope === 'mock-server') {
    const mockServer: InsomniaFile = {
      type: 'mock.insomnia.rest/5.0',
      name: workspace.name,
      meta: {
        id: workspace._id,
        created: workspace.created,
        modified: workspace.modified,
        isPrivate: workspace.isPrivate,
        description: workspace.description,
      },
      url: exportableResources.filter(models.mockServer.isMockServer)[0].url,
      useInsomniaCloud: exportableResources.filter(models.mockServer.isMockServer)[0].useInsomniaCloud,
      routes: getRoutesFromResources(exportableResources.filter(models.mockRoute.isMockRoute)),
    };

    return stringify(removeEmptyFields(mockServer), {});
  } else {
    throw new Error('Unknown workspace scope');
  }
};
