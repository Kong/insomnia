import { z, type ZodError } from 'zod/v4';

import type {
  ApiSpec,
  CookieJar,
  Environment,
  GrpcRequest,
  McpRequest,
  MockRoute,
  Request,
  SocketIORequest,
  UnitTest,
  UnitTestSuite,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import type { InsomniaImporter } from '~/main/importers/convert';

import { type AllTypes, type BaseModel } from '../models/index';

export { IMPORT_SOURCE_TYPES } from './import-source';
export type { ImportSourceType } from './import-source';
export type AllExportTypes =
  | 'request'
  | 'mcp_request'
  | 'grpc_request'
  | 'websocket_request'
  | 'websocket_payload'
  | 'socketio_request'
  | 'socketio_payload'
  | 'mock'
  | 'mock_route'
  | 'request_group'
  | 'unit_test_suite'
  | 'unit_test'
  | 'workspace'
  | 'cookie_jar'
  | 'environment'
  | 'api_spec'
  | 'proto_file'
  | 'proto_directory';
export interface ExportedModel extends BaseModel {
  _type: AllExportTypes;
}

export const isInsomniaV4Import = ({ id }: Pick<InsomniaImporter, 'id'>) => id === 'insomnia-4';

export interface ScanResult {
  requests?: (Request | WebSocketRequest | GrpcRequest | SocketIORequest)[];
  workspaces?: Workspace[];
  environments?: Environment[];
  apiSpecs?: ApiSpec[];
  cookieJars?: CookieJar[];
  unitTests?: UnitTest[];
  unitTestSuites?: UnitTestSuite[];
  mockRoutes?: MockRoute[];
  mcpRequests?: McpRequest[];
  type?: InsomniaImporter;
  oriFileName?: string;
  errors: string[];
}

// All models that can be exported should be listed here
export const MODELS_BY_EXPORT_TYPE: Record<AllExportTypes, AllTypes> = {
  request: 'Request',
  mcp_request: 'McpRequest',
  websocket_payload: 'WebSocketPayload',
  websocket_request: 'WebSocketRequest',
  socketio_payload: 'SocketIOPayload',
  socketio_request: 'SocketIORequest',
  mock: 'MockServer',
  mock_route: 'MockRoute',
  grpc_request: 'GrpcRequest',
  request_group: 'RequestGroup',
  unit_test_suite: 'UnitTestSuite',
  unit_test: 'UnitTest',
  workspace: 'Workspace',
  cookie_jar: 'CookieJar',
  environment: 'Environment',
  api_spec: 'ApiSpec',
  proto_file: 'ProtoFile',
  proto_directory: 'ProtoDirectory',
};

export { mcpUrlToInsomniaV5Yaml } from './insomnia-v5';

type ZodTreeifiedError = ReturnType<typeof z.treeifyError<any>>;

export function extractErrorMessages(v5Error: ZodError | any): string[] {
  const messages: [string, string[]][] = [];
  function walkError(err: ZodTreeifiedError, path = '') {
    if (err.errors.length > 0) {
      messages.push([path, err.errors]);
    }
    if ('properties' in err) {
      for (const [key, value] of Object.entries(err.properties!)) {
        if (value) {
          walkError(value, path ? `${path}.${key}` : key);
        }
      }
    }
    if ('items' in err) {
      (err.items as (ZodTreeifiedError | undefined)[]).forEach((item, index) => {
        if (item) {
          walkError(item, path ? `${path}.${index}` : String(index));
        }
      });
    }
  }

  if ('issues' in v5Error) {
    const errors = z.treeifyError(v5Error);
    walkError(errors);
    return messages.map(([path, errs]) => `"${path}": ${errs.join('; ')}`);
  }
  return 'message' in v5Error ? [v5Error.message] : typeof v5Error === 'string' ? [v5Error] : [];
}

export const isApiSpecImport = ({ id }: Pick<InsomniaImporter, 'id'>) => id === 'openapi3' || id === 'swagger2';

export function pathPatternMatches(pattern: string, concretePath: string): boolean {
  if (!pattern || pattern.length > 200) {
    return false;
  }
  if (pattern === concretePath) {
    return true;
  }
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = concretePath.split('/').filter(Boolean);
  if (patternSegments.length > pathSegments.length) {
    return false;
  }
  const offset = pathSegments.length - patternSegments.length;
  const pathSuffix = pathSegments.slice(offset);
  return patternSegments.every((segment, i) => {
    if (segment.startsWith(':')) {
      return pathSuffix[i].length > 0;
    }
    return segment.toLowerCase() === pathSuffix[i].toLowerCase();
  });
}
