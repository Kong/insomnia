import { parse } from 'yaml';

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
import { type InsomniaFile, insomniaFileSchema, type Meta, WebsocketRequestSchema } from './schema';

function mapMetaToInsomniaMeta(meta: Meta): {
  _id: string;
  created: number;
  modified: number;
  isPrivate: boolean;
} {
  return {
    _id: meta.id,
    created: meta.created || Date.now(),
    modified: meta.modified || Date.now(),
    isPrivate: meta.isPrivate || false,
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

function getWorkspace(file: InsomniaFile): Workspace {
  return {
    ...mapMetaToInsomniaMeta(file.meta || {
      id: '__WORKSPACE_ID__',
    }),
    type: 'Workspace',
    // @ts-expect-error -- TSCONVERSION
    _type: EXPORT_TYPE_WORKSPACE,
    name: file.name || 'Imported Collection',
    parentId: '',
    scope: getScope(file),
  };
}

// function getCertificates(file: InsomniaFile): CaCertificate[] {
//   if ('certificates' in file) {
//     return file.certificates?.map(certificate => ({
//       ...mapMetaToInsomniaMeta(certificate.meta || {
//         id: '__CERTIFICATE_ID__',
//       }),
//       type: 'CaCertificate',
//       _type: EXPORTTYPE,
//       name: '',
//       parentId: file.meta?.id || '',
//       path: certificate.path,
//       disabled: certificate.disabled,
//     })) || [];
//   }

//   return [];
// }

function getEnvironments(file: InsomniaFile): Environment[] {
  if ('environments' in file) {
    return file.environments?.map(environment => ({
      ...mapMetaToInsomniaMeta(environment.meta || {
        id: '__ENVIRONMENT_ID__',
      }),
      type: 'Environment',
      _type: EXPORT_TYPE_ENVIRONMENT,
      name: environment.name || 'Imported Environment',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      data: environment.data as Record<string, string>,
      dataPropertyOrder: {},
      color: environment.color || null,
      metaSortKey: 0,
    })) || [];
  }

  return [];
}

function getCookieJar(file: InsomniaFile): [CookieJar] | [] {
  if ('cookieJar' in file && file.cookieJar) {
    const cookieJar: CookieJar = {
      ...mapMetaToInsomniaMeta(file.cookieJar.meta || {
        id: '__COOKIE_JAR_ID__',
      }),
      type: 'CookieJar',
      // @ts-expect-error -- TSCONVERSION
      _type: EXPORT_TYPE_COOKIE_JAR,
      name: file.cookieJar.name || 'Imported Cookie Jar',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      cookies: file.cookieJar.cookies || [],
    };

    return [cookieJar];
  }

  return [];
}

function getApiSpec(file: InsomniaFile): [ApiSpec] | [] {
  if ('spec' in file && file.spec) {
    return [{
      ...mapMetaToInsomniaMeta(file.meta || {
        id: '__API_SPEC_ID__',
      }),
      type: 'ApiSpec',
      // @ts-expect-error -- TSCONVERSION
      _type: EXPORT_TYPE_API_SPEC,
      fileName: 'file' in file.spec ? file.spec.file : '',
      contentType: 'json',
      contents: 'contents' in file.spec && file.spec.contents ? JSON.stringify(file.spec.contents) : '' || '',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
    }];
  }

  return [];
}

function getMockServer(file: InsomniaFile): MockServer {
  if (file.type === 'mock.insomnia.rest/5.0') {
    return {
      ...mapMetaToInsomniaMeta(file.meta || {
        id: '__MOCK_SERVER_ID__',
      }),
      type: 'MockServer',
      // @ts-expect-error -- TSCONVERSION
      _type: EXPORT_TYPE_MOCK_SERVER,
      name: file.name || 'Imported Mock Server',
      parentId: file.meta?.id || '',
      url: file.url || '',
      useInsomniaCloud: file.useInsomniaCloud || false,
    };
  }

  throw new Error('No Mock Server found');
}

function getMockRoutes(file: InsomniaFile): MockRoute[] {
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
      const suite: UnitTestSuite = {
        ...mapMetaToInsomniaMeta(testSuite.meta || {
          id: '__UNIT_TEST_SUITE_ID__',
        }),
        type: 'UnitTestSuite',
        // @ts-expect-error -- TSCONVERSION
        _type: EXPORT_TYPE_UNIT_TEST_SUITE,
        name: testSuite.name || 'Imported Test Suite',
        parentId: file.meta?.id || '__WORKSPACE_ID__',
        metaSortKey: index,
      };

      resources.push(suite);

      const tests: UnitTest[] = testSuite.tests?.map((test, index) => ({
        ...mapMetaToInsomniaMeta(test.meta || {
          id: '__UNIT_TEST_ID__',
        }),
        type: 'UnitTest',
        _type: EXPORT_TYPE_UNIT_TEST,
        name: test.name || 'Imported Test',
        parentId: suite._id,
        requestId: test.requestId,
        code: test.code,
        metaSortKey: index,
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
      collection.forEach(item => {
        if ('children' in item) {
          const requestGroup: RequestGroup = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__REQUEST_GROUP_ID__',
            }),
            type: 'RequestGroup',
            // @ts-expect-error -- TSCONVERSION
            _type: EXPORT_TYPE_REQUEST_GROUP,
            name: item.name || 'Imported Folder',
            parentId,
          };

          resources.push(requestGroup);

          walkCollection(item.children, requestGroup._id);
        } else if ('method' in item) {
          const request: Request = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__REQUEST_ID__',
            }),
            type: 'Request',
            // @ts-expect-error -- TSCONVERSION
            _type: EXPORT_TYPE_REQUEST,
            name: item.name || 'Imported Request',
            parentId,
            url: item.url,
            method: item.method,
            body: item.body || {},
            parameters: item.parameters || [],
            headers: item.headers || [],
            authentication: item.authentication || {},
            preRequestScript: item.preRequestScript || '',
            settingDisableRenderRequestBody: item.settingDisableRenderRequestBody,
            settingEncodeUrl: item.settingEncodeUrl,
            settingFollowRedirects: item.settingFollowRedirects,
            settingSendCookies: item.settingSendCookies,
            settingStoreCookies: item.settingStoreCookies,
            settingRebuildPath: item.settingRebuildPath,
            afterResponseScript: item.afterResponseScript || '',
            pathParameters: item.pathParameters || [],
            metaSortKey: 0,
          };

          resources.push(request);
        } else if ('protoMethodName' in item) {
          const grpcRequest: GrpcRequest = {
            ...mapMetaToInsomniaMeta(item.meta || {
              id: '__GRPC_REQUEST_ID__',
            }),
            type: 'GrpcRequest',
            // @ts-expect-error -- TSCONVERSION
            _type: EXPORT_TYPE_GRPC_REQUEST,
            name: item.name || 'Imported gRPC Request',
            parentId,
            url: item.url,
            protoMethodName: item.protoMethodName,
            metadata: item.metadata || [],
            body: item.body || {},
            metaSortKey: 0,
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
            const websocketRequest: WebSocketRequest = {
              ...mapMetaToInsomniaMeta(data.meta || {
                id: '__WEBSOCKET_REQUEST_ID__',
              }),
              type: 'WebSocketRequest',
              // @ts-expect-error -- TSCONVERSION
              _type: EXPORT_TYPE_WEBSOCKET_REQUEST,
              name: item.name || 'Imported WebSocket Request',
              parentId,
              url: data.url,
              authentication: data.authentication || {},
              metaSortKey: 0,
              headers: data.headers || [],
              description: data.description || '',
              parameters: data.parameters || [],
              settingEncodeUrl: data.settingEncodeUrl,
              settingFollowRedirects: data.settingFollowRedirects,
              settingSendCookies: data.settingSendCookies,
              settingStoreCookies: data.settingStoreCookies,
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
