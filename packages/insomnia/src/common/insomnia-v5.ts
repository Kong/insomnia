/**
 * Insomnia v5 Data Import/Export Utilities
 *
 * This module handles the conversion between Insomnia's internal data models and the v5 export format.
 * It provides functions to import data from v5 YAML files and export current workspace data to v5 format.
 *
 * Key responsibilities:
 * - Parse and validate v5 YAML files using Zod schemas
 * - Convert between internal models and v5 export format
 * - Handle different workspace scopes (collection, design, environment, mock-server)
 * - Support legacy migration from older formats
 *
 */

import type {
  ApiSpec,
  BaseModel,
  CookieJar,
  Environment,
  EnvironmentKvPairData,
  GrpcRequest,
  McpRequest,
  MockRoute,
  MockServer,
  Request,
  RequestBody,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  SocketIORequest,
  UnitTest,
  UnitTestSuite,
  WebSocketRequest,
  Workspace,
  WorkspaceScope,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { parse, stringify } from 'yaml';

import { type AllExportTypes, MODELS_BY_EXPORT_TYPE } from '~/common/import';
import { migrateToLatestYaml } from '~/common/insomnia-schema-migrations';
import { INSOMNIA_SCHEMA_VERSION } from '~/common/insomnia-schema-migrations/schema-version';
import { maskVaultEnvironmentData } from '~/utils/environment-utils';
import { invariant } from '~/utils/invariant';

import { database } from './database';
import {
  type Insomnia_GRPCRequest,
  type Insomnia_Request,
  type Insomnia_RequestGroup,
  type Insomnia_SocketIORequest,
  type Insomnia_WebsocketRequest,
  type InsomniaFile,
  InsomniaFileSchema,
  McpRequestSchema,
  type Meta,
  SocketIORequestSchema,
  WebsocketRequestSchema,
} from './import-v5-parser';

/**
 * Type helper that adds the export type field to any BaseModel
 * This is used to ensure all exported models have the correct _type field for v5 format
 */
type WithExportType<T extends BaseModel> = T & { _type: AllExportTypes };

/**
 * Maps request headers from internal format to v5 export format
 * Filters out empty headers and ensures all required fields are present
 *
 * @param headers - Array of request headers from internal model
 * @returns Array of headers in v5 export format, filtered to remove empty entries
 */
function mapHeaders(headers?: RequestHeader[]) {
  if (!headers || headers.length === 0) {
    return [];
  }

  return headers
    .map(header => ({
      name: header.name || '',
      value: header.value || '',
      description: header.description,
      disabled: header.disabled,
    }))
    .filter(header => header.name || header.value);
}

/**
 * Maps request parameters from internal format to v5 export format
 * Filters out empty parameters and preserves all parameter metadata
 *
 * @param parameters - Array of request parameters from internal model
 * @returns Array of parameters in v5 export format, filtered to remove empty entries
 */
function mapParameters(parameters?: RequestParameter[]) {
  if (!parameters || parameters.length === 0) {
    return [];
  }

  return parameters
    .map(param => ({
      name: param.name || '',
      value: param.value || '',
      description: param.description,
      disabled: param.disabled,
      type: param.type,
      multiline: param.multiline,
    }))
    .filter(param => param.name || param.value);
}

/**
 * Maps metadata from internal resource format to v5 export format
 * Extracts common metadata fields that are shared across all resource types
 *
 * @param resource - The resource object to extract metadata from
 * @returns Metadata object in v5 format, or undefined if resource is null/undefined
 */
function mapMeta(resource: Request | WebSocketRequest | SocketIORequest | GrpcRequest) {
  if (!resource) {
    return;
  }

  return {
    id: resource._id,
    created: resource.created,
    modified: resource.modified,
    isPrivate: resource.isPrivate,
    description: resource.description,
    sortKey: resource.metaSortKey,
  };
}

/**
 * Maps metadata from RequestGroup to v5 export format
 * Similar to mapMeta but specifically for request groups
 *
 * @param resource - The RequestGroup object to extract metadata from
 * @returns Metadata object in v5 format, or undefined if resource is null/undefined
 */
function mapGroupMeta(resource: RequestGroup) {
  if (!resource) {
    return;
  }

  return {
    id: resource._id,
    created: resource.created,
    modified: resource.modified,
    isPrivate: resource.isPrivate,
    sortKey: resource.metaSortKey,
    description: resource.description,
  };
}

/**
 * Maps metadata from Workspace to v5 export format
 * Extracts workspace-specific metadata fields
 *
 * @param workspace - The Workspace object to extract metadata from
 * @returns Metadata object in v5 format, or undefined if workspace is null/undefined
 */
function mapWorkspaceMeta(workspace: Workspace) {
  if (!workspace) {
    return;
  }

  return {
    id: workspace._id,
    created: workspace.created,
    modified: workspace.modified,
    isPrivate: workspace.isPrivate,
    description: workspace.description,
  };
}

/**
 * Maps request body from internal format to v5 export format
 * Handles different body types including form data, raw text, and file uploads
 *
 * @param body - The request body object from internal model
 * @returns Body object in v5 format with all body parameters mapped
 */
function mapBody(body?: RequestBody) {
  return {
    mimeType: body?.mimeType,
    text: body?.text,
    fileName: body?.fileName,
    params: body?.params?.map(param => ({
      name: param.name,
      value: param.value,
      description: param.description,
      disabled: param.disabled,
      multiline: param.multiline,
      fileName: param.fileName,
      type: param.type,
    })),
  };
}

/**
 * Helper function to check if a value should be considered empty
 * Used to filter out null, undefined, and empty objects from export data
 * Special handling for folder structures to preserve empty folders
 *
 * @param value - The value to check
 * @returns true if the value is not empty, false otherwise
 */
function filterEmptyValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return false;
  }

  // Special case: preserve folder structures even if they appear empty
  // This ensures empty folders are not removed during export
  if (typeof value === 'object' && value !== null) {
    // If it has a 'type' field (indicating it's a folder/workspace structure), preserve it
    if ('type' in value && typeof (value as any).type === 'string') {
      return true;
    }
    // Otherwise, check if it has any non-empty properties
    return Object.keys(value).length > 0;
  }

  return true;
}

/**
 * Recursively removes empty fields from an object or array
 * This is used to clean up export data by removing null, undefined, and empty objects
 * Special handling for folder structures to preserve empty children arrays
 *
 * @param data - The data structure to clean
 * @returns Cleaned data with empty fields removed, or undefined if all fields are empty
 */
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

/**
 * Maps v5 metadata format to internal Insomnia metadata format
 * Converts v5 meta objects to the format expected by internal models
 *
 * @param meta - The v5 metadata object
 * @returns Internal metadata format with defaults applied
 */
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

/**
 * Maps Insomnia v5 schema types to internal workspace scopes
 * This is used to determine the correct scope when importing v5 files
 *
 * @param type - The schema type from the v5 file
 * @returns The corresponding workspace scope
 */
export function insomniaSchemaTypeToScope(type: InsomniaFile['type']): WorkspaceScope {
  if (type === 'collection.insomnia.rest/5.0') {
    return 'collection';
  } else if (type === 'environment.insomnia.rest/5.0') {
    return 'environment';
  } else if (type === 'spec.insomnia.rest/5.0') {
    return 'design';
  } else if (type === 'mcpClient.insomnia/5.0') {
    return 'mcp';
  }
  return 'mock-server';
}

function getWorkspace(file: InsomniaFile): WithExportType<Workspace> {
  return {
    ...mapMetaToInsomniaMeta(
      file.meta || {
        id: '__WORKSPACE_ID__',
      },
    ),
    type: 'Workspace',
    _type: 'workspace',
    name: file.name || 'Imported Collection',
    parentId: '',
    scope: insomniaSchemaTypeToScope(file.type),
  };
}

function getEnvironments(file: InsomniaFile): Environment[] {
  if ('environments' in file && file.environments) {
    const baseEnvironment: WithExportType<Environment> = {
      ...mapMetaToInsomniaMeta(
        file.environments.meta || {
          id: '__ENVIRONMENT_ID__',
        },
      ),
      type: 'Environment',
      _type: 'environment',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      color: file.environments.color || null,
      data: (file.environments.data as Record<string, any>) || {},
      dataPropertyOrder: (file.environments.dataPropertyOrder as Record<string, any>) || undefined,
      name: file.environments.name || 'Base Environment',
    };

    const subEnvironments: WithExportType<Environment>[] =
      file.environments.subEnvironments?.map((environment, index) => ({
        ...mapMetaToInsomniaMeta(
          environment.meta || {
            id: '__ENVIRONMENT_ID__',
          },
        ),
        type: 'Environment',
        _type: 'environment',
        color: environment.color || null,
        data: (environment.data as Record<string, any>) || {},
        dataPropertyOrder: (environment.dataPropertyOrder as Record<string, any>) || undefined,
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
      ...mapMetaToInsomniaMeta(
        file.cookieJar.meta || {
          id: '__COOKIE_JAR_ID__',
        },
      ),
      type: 'CookieJar',
      _type: 'cookie_jar',
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
    return [
      {
        ...mapMetaToInsomniaMeta(
          file.spec.meta || {
            id: '__API_SPEC_ID__',
          },
        ),
        type: 'ApiSpec',
        name: file.name || 'Api Spec',
        _type: 'api_spec',
        fileName: 'file' in file.spec ? file.spec.file : '',
        contentType: 'json',
        contents: 'contents' in file.spec && file.spec.contents ? stringify(file.spec.contents) : '',
        parentId: file.meta?.id || '__WORKSPACE_ID__',
      },
    ];
  }

  return [];
}

function getMockServer(file: InsomniaFile): WithExportType<MockServer> {
  if (file.type === 'mock.insomnia.rest/5.0') {
    return {
      ...mapMetaToInsomniaMeta(
        file.server?.meta || {
          id: '__MOCK_SERVER_ID__',
        },
      ),
      type: 'MockServer',
      _type: 'mock',
      name: file.name || 'Imported Mock Server',
      parentId: file.meta?.id || '__WORKSPACE_ID__',
      url: file.server?.url || '',
      useInsomniaCloud: file.server?.useInsomniaCloud || false,
    };
  }

  throw new Error('No Mock Server found');
}

function getMockRoutes(file: InsomniaFile): WithExportType<MockRoute>[] {
  if (file.type === 'mock.insomnia.rest/5.0') {
    return (
      file.routes?.map(mock => ({
        ...mapMetaToInsomniaMeta(
          mock.meta || {
            id: '__MOCK_ROUTE_ID__',
          },
        ),
        type: 'MockRoute',
        _type: 'mock_route',
        name: mock.name || 'Imported Mock Route',
        parentId: file.server?.meta?.id || '__MOCK_SERVER_ID__',
        body: mock.body || '',
        headers:
          mock.headers?.map(header => ({
            name: header.name || '',
            value: header.value || '',
            description: header.description,
            disabled: header.disabled,
          })) || [],
        method: mock.method || '',
        mimeType: mock.mimeType || '',
        statusCode: mock.statusCode,
        statusText: mock.statusText || '',
      })) || []
    );
  }

  return [];
}

function getTestSuites(file: InsomniaFile): (UnitTestSuite | UnitTest)[] {
  if (file.type === 'spec.insomnia.rest/5.0') {
    const resources: (UnitTestSuite | UnitTest)[] = [];

    file.testSuites?.forEach((testSuite, index) => {
      const suite: WithExportType<UnitTestSuite> = {
        ...mapMetaToInsomniaMeta(
          testSuite.meta || {
            id: '__UNIT_TEST_SUITE_ID__',
          },
        ),
        type: 'UnitTestSuite',
        _type: 'unit_test_suite',
        name: testSuite.name || 'Imported Test Suite',
        parentId: file.meta?.id || '__WORKSPACE_ID__',
        metaSortKey: testSuite.meta?.sortKey ?? index,
      };

      resources.push(suite);

      const tests: WithExportType<UnitTest>[] =
        testSuite.tests?.map((test, index) => ({
          ...mapMetaToInsomniaMeta(
            test.meta || {
              id: '__UNIT_TEST_ID__',
            },
          ),
          type: 'UnitTest',
          _type: 'unit_test',
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

function getCollection(
  file: InsomniaFile,
): (Request | WebSocketRequest | SocketIORequest | GrpcRequest | RequestGroup)[] {
  if (file.type === 'collection.insomnia.rest/5.0' || file.type === 'spec.insomnia.rest/5.0') {
    const resources: (Request | WebSocketRequest | SocketIORequest | GrpcRequest | RequestGroup)[] = [];

    function walkCollection(
      collection: Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'],
      parentId: string,
    ) {
      collection?.forEach(item => {
        // Detect groups: items that are NOT requests, gRPC, or WebSocket
        const isGroup = !('method' in item) && !('reflectionApi' in item) && !('url' in item);

        if (isGroup) {
          const requestGroup: WithExportType<RequestGroup> = {
            ...mapMetaToInsomniaMeta(
              item.meta || {
                id: '__REQUEST_GROUP_ID__',
              },
            ),
            type: 'RequestGroup',
            _type: 'request_group',
            name: item.name || 'Imported Folder',
            parentId,
            headers: mapHeaders(item.headers),
            preRequestScript: item.scripts?.preRequest || '',
            afterResponseScript: item.scripts?.afterResponse || '',
            authentication: item.authentication || {},
            environment: (item.environment as Record<string, any>) || {},
            // 🚧 WARNING 🚧 If we set the order to an empty object instead of undefined it will remove the environment from the folder due to filtering logic (related to json-order)
            environmentPropertyOrder: (item.environmentPropertyOrder as Record<string, any>) || undefined,
          };

          resources.push(requestGroup);

          // Process children if they exist
          if (item.children && Array.isArray(item.children)) {
            walkCollection(item.children, requestGroup._id);
          }
        } else if ('method' in item && item.method) {
          const request: WithExportType<Request> = {
            ...mapMetaToInsomniaMeta(
              item.meta || {
                id: '__REQUEST_ID__',
              },
            ),
            type: 'Request',
            _type: 'request',
            name: item.name || 'Imported Request',
            parentId,
            url: item.url,
            method: item.method,
            body: mapBody(item.body),
            parameters: mapParameters(item.parameters),
            headers: mapHeaders(item.headers),
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
            disableUserAgentHeader: false,
          };

          resources.push(request);
        } else if ('reflectionApi' in item) {
          const grpcRequest: WithExportType<GrpcRequest> = {
            ...mapMetaToInsomniaMeta(
              item.meta || {
                id: '__GRPC_REQUEST_ID__',
              },
            ),
            type: 'GrpcRequest',
            _type: 'grpc_request',
            name: item.name || 'Imported gRPC Request',
            parentId,
            url: item.url,
            protoMethodName: item.protoMethodName,
            metadata: mapHeaders(item.metadata),
            body: item.body || {},
            metaSortKey: item.meta?.sortKey ?? 0,
            reflectionApi: item.reflectionApi || {
              enabled: false,
              url: '',
              apiKey: '',
              module: '',
            },
            protoFileId: item.protoFileId || '',
            disableUserAgentHeader: false,
          };

          resources.push(grpcRequest);
        } else {
          const wbRequest = WebsocketRequestSchema.safeParse(item);
          if (wbRequest.success) {
            const data = wbRequest.data;
            const websocketRequest: WithExportType<WebSocketRequest> = {
              ...mapMetaToInsomniaMeta(
                data.meta || {
                  id: '__WEBSOCKET_REQUEST_ID__',
                },
              ),
              type: 'WebSocketRequest',
              _type: 'websocket_request',
              name: item.name || 'Imported WebSocket Request',
              parentId,
              url: data.url,
              authentication: data.authentication || {},
              metaSortKey: item.meta?.sortKey ?? 0,
              headers: mapHeaders(data.headers),
              parameters: mapParameters(data.parameters),
              settingEncodeUrl: data.settings.encodeUrl,
              settingFollowRedirects: data.settings.followRedirects,
              settingSendCookies: data.settings.cookies.send,
              settingStoreCookies: data.settings.cookies.store,
              pathParameters: data.pathParameters || [],
              disableUserAgentHeader: false,
            };

            resources.push(websocketRequest);
          } else {
            const socketIORequest = SocketIORequestSchema.safeParse(item);
            if (socketIORequest.success) {
              const data = socketIORequest.data;
              const socketIO: WithExportType<SocketIORequest> = {
                ...mapMetaToInsomniaMeta(
                  data.meta || {
                    id: '__SOCKET_IO_REQUEST_ID__',
                  },
                ),
                type: 'SocketIORequest',
                _type: 'socketio_request',
                name: item.name || 'Imported Socket.IO Request',
                parentId,
                url: data.url,
                authentication: data.authentication || {},
                metaSortKey: item.meta?.sortKey ?? 0,
                headers: mapHeaders(data.headers),
                parameters: mapParameters(data.parameters),
                settingEncodeUrl: data.settings.encodeUrl,
                settingSendCookies: data.settings.cookies.send,
                settingStoreCookies: data.settings.cookies.store,
                settingPath: data.settings.path,
                pathParameters: data.pathParameters || [],
                eventListeners: data.eventListeners || [],
                disableUserAgentHeader: false,
              };

              resources.push(socketIO);
            }
          }
        }
      });
    }

    walkCollection(file.collection, file.meta?.id || '__WORKSPACE_ID__');

    return resources;
  }

  return [];
}

function getMcpRequest(file: InsomniaFile): WithExportType<McpRequest>[] {
  const commonProps: WithExportType<McpRequest> = {
    ...mapMetaToInsomniaMeta({
      id: '__MCP_CLIENT_ID__',
    }),
    parentId: file.meta?.id || '__WORKSPACE_ID__',
    name: file.name || 'MCP Client',
    type: 'McpRequest',
    _type: 'mcp_request',
    url: '',
    transportType: 'streamable-http',
    description: '',
    authentication: {},
    headers: [],
    env: [],
    connected: false,
    mcpStdioAccess: false,
    roots: [],
    subscribeResources: [],
    sslValidation: true,
    disableUserAgentHeader: false,
  };

  if ('mcpRequest' in file && file.mcpRequest) {
    const mcpRequestParser = McpRequestSchema.safeParse(file.mcpRequest);
    if (mcpRequestParser.success) {
      const data = mcpRequestParser.data;
      return [
        {
          ...commonProps,
          ...mapMetaToInsomniaMeta(
            data.meta || {
              id: '__MCP_CLIENT_ID__',
            },
          ),
          url: data.url,
          transportType: data.transportType,
          authentication: data.authentication || {},
          headers: mapHeaders(data.headers),
          env: (data.env as EnvironmentKvPairData[]) || [],
        },
      ];
    }
  }

  return [commonProps];
}

function importData(rawData: string) {
  // Apply schema migration before parsing to handle older schema versions
  const migratedData = migrateToLatestYaml(rawData);
  const fileSchemaParser = InsomniaFileSchema.safeParse(parse(migratedData));

  if (fileSchemaParser.success) {
    const file = fileSchemaParser.data;
    if (file.type === 'collection.insomnia.rest/5.0') {
      return [getWorkspace(file), ...getEnvironments(file), ...getCookieJar(file), ...getCollection(file)];
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
      return [getWorkspace(file), ...getEnvironments(file)];
    }

    if (file.type === 'mock.insomnia.rest/5.0') {
      return [getWorkspace(file), getMockServer(file), ...getMockRoutes(file)];
    }
    if (file.type === 'mcpClient.insomnia/5.0') {
      return [getWorkspace(file), ...getEnvironments(file), ...getMcpRequest(file)];
    }
    // @ts-expect-error: Exhaustiveness check
    throw new Error(`No import handler found for type ${file.type}`);
  }
  throw new Error(`Failed to parse yaml file to Insomnia schema ${fileSchemaParser.error?.toString()}`);
}

/**
 * Safely imports Insomnia v5 data with error handling
 * This is the main entry point for importing v5 files - it catches any parsing errors
 * and returns them in a structured format rather than throwing
 *
 * @param rawData - Raw YAML string data from the v5 file
 * @returns Object containing either the parsed data or an error
 */
export function tryImportV5Data(rawData: string) {
  try {
    return { data: importData(rawData) };
  } catch (error) {
    console.error('Failed to import Insomnia v5 data', error);
    return { data: [], error };
  }
}

/**
 * Imports Insomnia v5 data, returning empty array on error
 * Alternative to tryImportV5Data that always returns an array
 *
 * @param rawData - Raw YAML string data from the v5 file
 * @returns Array of imported models, or empty array if import fails
 */
export function importInsomniaV5Data(rawData: string) {
  try {
    return importData(rawData);
  } catch (err) {
    console.error('Failed to import Insomnia v5 data', err);
    return [];
  }
}

export function mcpUrlToInsomniaV5Yaml(mcpUrl: string): string {
  const url = new URL(mcpUrl.trim());
  const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
  invariant(isHttp, 'MCP server URL must use http or https');
  const mcpClient = {
    type: 'mcpClient.insomnia/5.0' as const,
    schema_version: INSOMNIA_SCHEMA_VERSION,
    name: 'Imported MCP Client',
    mcpRequest: {
      name: 'Imported MCP Client',
      url: mcpUrl.trim(),
      transportType: 'streamable-http' as const,
    },
  };
  const parsed = InsomniaFileSchema.parse(mcpClient);
  return stringify(removeEmptyFields(parsed));
}

/**
 * Exports workspace data to Insomnia v5 format
 * This is the main export function that converts internal models to v5 YAML format
 *
 * @param workspaceId - ID of the workspace to export
 * @param includePrivateEnvironments - Whether to include private environment data
 * @param requestIds - Optional array of specific request IDs to export (if not provided, exports all)
 * @returns YAML string containing the exported workspace data
 */
export async function getInsomniaV5DataExport({
  workspaceId,
  includePrivateEnvironments,
  requestIds,
}: {
  workspaceId: string;
  includePrivateEnvironments: boolean;
  requestIds?: string[];
}) {
  try {
    const workspace = await services.workspace.getById(workspaceId);

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Get all model types that can be exported
    const exportableTypes = Object.values(MODELS_BY_EXPORT_TYPE);

    // Fetch all descendants of the workspace (requests, folders, environments, etc.)
    const workspaceDescendants = await database.getWithDescendants(workspace, exportableTypes);

    // Filter to only include resources that are exportable
    const exportableResources = workspaceDescendants.filter(resource => {
      if (exportableTypes.includes(resource.type)) {
        return true;
      }

      return false;
    });

    /**
     * Recursively builds a collection structure from flat resource list
     * This function converts the flat list of resources into a hierarchical structure
     * that matches the v5 export format with proper parent-child relationships
     *
     * @param resources - Flat array of all resources in the workspace
     * @param parentId - ID of the parent to build children for
     * @returns Hierarchical collection structure in v5 format
     */
    function getCollectionFromResources(
      resources: (Request | RequestGroup | WebSocketRequest | GrpcRequest | SocketIORequest)[],
      parentId: string,
    ): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'] {
      const collection: Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection'] = [];

      // Filter resources based on requestIds filter and parent relationship
      resources
        .filter(resource => {
          // Include all request groups, or filter by requestIds if specified
          if (!requestIds || requestIds.length === 0 || models.requestGroup.isRequestGroup(resource)) {
            return true;
          }

          return requestIds.includes(resource._id);
        })
        .filter(resource => resource.parentId === parentId)
        .forEach(resource => {
          // Convert HTTP requests to v5 format
          if (models.request.isRequest(resource)) {
            const request: Insomnia_Request = {
              url: resource.url,
              name: resource.name,
              meta: mapMeta(resource),
              method: resource.method,
              body: mapBody(resource.body),
              parameters: mapParameters(resource.parameters),
              headers: mapHeaders(resource.headers),
              authentication: resource.authentication,
              scripts: getScriptFromResources(resource),
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
            // Convert request groups (folders) to v5 format
            const requestGroup: Insomnia_RequestGroup = {
              name: resource.name,
              meta: mapGroupMeta(resource),
              children: getCollectionFromResources(resources, resource._id), // Recursively build children
              scripts: getScriptFromResources(resource),
              authentication: resource.authentication,
              environment: resource.environment,
              environmentPropertyOrder: resource.environmentPropertyOrder,
              headers: mapHeaders(resource.headers),
            };
            collection.push(requestGroup);
          } else if (models.webSocketRequest.isWebSocketRequest(resource)) {
            // Convert WebSocket requests to v5 format
            const webSocketRequest: Insomnia_WebsocketRequest = {
              url: resource.url,
              name: resource.name,
              meta: mapMeta(resource),
              settings: {
                encodeUrl: resource.settingEncodeUrl,
                followRedirects: resource.settingFollowRedirects,
                cookies: {
                  send: resource.settingSendCookies,
                  store: resource.settingStoreCookies,
                },
              },
              authentication: resource.authentication,
              headers: mapHeaders(resource.headers),
              parameters: mapParameters(resource.parameters),
              pathParameters: resource.pathParameters,
            };
            collection.push(webSocketRequest);
          } else if (models.socketIORequest.isSocketIORequest(resource)) {
            const socketIORequest: Insomnia_SocketIORequest = {
              url: resource.url,
              name: resource.name,
              meta: mapMeta(resource),
              settings: {
                encodeUrl: resource.settingEncodeUrl,
                cookies: {
                  send: resource.settingSendCookies,
                  store: resource.settingStoreCookies,
                },
                path: resource.settingPath,
              },
              authentication: resource.authentication,
              headers: mapHeaders(resource.headers),
              parameters: mapParameters(resource.parameters),
              pathParameters: resource.pathParameters,
              eventListeners: resource.eventListeners,
            };
            collection.push(socketIORequest);
          } else if (models.grpcRequest.isGrpcRequest(resource)) {
            const grpcRequest: Insomnia_GRPCRequest = {
              url: resource.url,
              name: resource.name,
              meta: mapMeta(resource),
              body: resource.body,
              metadata: mapHeaders(resource.metadata),
              protoFileId: resource.protoFileId || '',
              protoMethodName: resource.protoMethodName,
              reflectionApi: resource.reflectionApi,
            };

            collection.push(grpcRequest);
          }
        });

      return collection;
    }

    function getScriptFromResources(resource: Request | RequestGroup) {
      const hasPreRequest = !!resource?.preRequestScript;
      const hasAfterResponse = !!resource?.afterResponseScript;

      if (!hasPreRequest && !hasAfterResponse) {
        return;
      }

      const scripts: { preRequest?: string; afterResponse?: string } = {};
      if (hasPreRequest) {
        scripts.preRequest = resource.preRequestScript;
      }
      if (hasAfterResponse) {
        scripts.afterResponse = resource.afterResponseScript;
      }

      return scripts;
    }

    function getEnvironmentsFromResources(
      resources: Environment[],
      includePrivateEnvironments: boolean,
    ): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['environments'] {
      const baseEnvironment = resources.find(environment => environment.parentId.startsWith('wrk_'));

      if (!baseEnvironment) {
        throw new Error('Base environment not found');
      }

      const subEnvironments = resources
        .filter(environment => environment.parentId === baseEnvironment?._id)
        .filter(environment => includePrivateEnvironments || !environment.isPrivate);

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
        subEnvironments: subEnvironments.map(maskVaultEnvironmentData).map(subEnvironment => ({
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

    function getCookieJarFromResources(
      resources: CookieJar[],
    ): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['cookieJar'] {
      return resources.map(resource => ({
        name: resource.name,
        meta: {
          id: resource._id,
          created: resource.created,
          modified: resource.modified,
          isPrivate: resource.isPrivate,
        },
        cookies: resource.cookies.map(cookie => ({
          id: cookie.id,
          key: cookie.key,
          value: cookie.value,
          expires: cookie.expires ? new Date(cookie.expires) : null,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          extensions: cookie.extensions,
          creation: cookie.creation,
          creationIndex: cookie.creationIndex,
          hostOnly: cookie.hostOnly,
          pathIsDefault: cookie.pathIsDefault,
          lastAccessed: cookie.lastAccessed,
        })),
      }))[0];
    }

    function getTestSuitesFromResources(
      resources: (UnitTestSuite | UnitTest)[],
    ): Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['testSuites'] {
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

    function getSpecFromResources(
      resources: ApiSpec[],
    ): Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['spec'] {
      const spec = resources[0];
      // const parser = spec.contentType === 'json' ? JSON.parse : parse;
      let contents = {};

      try {
        contents = JSON.parse(spec.contents);
      } catch {
        // @TODO For some reason switching a spec from JSON to YAML doesn't update it's content type so we need to handle both here
        // This must be fixed in the apiSpec model
        try {
          contents = parse(spec.contents);
        } catch (err) {
          console.error('Failed to parse spec contents', err);
        }
      }
      return {
        // @TODO In the future we want to support also reading from a file like this: file: resources[0].fileName,
        contents,
        meta: {
          id: spec._id,
          created: spec.created,
          modified: spec.modified,
          isPrivate: spec.isPrivate,
        },
      };
    }

    function getRoutesFromResources(
      resources: MockRoute[],
    ): Extract<InsomniaFile, { type: 'mock.insomnia.rest/5.0' }>['routes'] {
      return resources.map(resource => ({
        name: resource.name,
        meta: {
          id: resource._id,
          created: resource.created,
          modified: resource.modified,
          isPrivate: resource.isPrivate,
        },
        body: resource.body,
        headers: resource.headers.map(header => ({
          name: header.name,
          value: header.value,
          description: header.description,
          disabled: header.disabled,
        })),
        method: resource.method,
        mimeType: resource.mimeType,
        statusCode: resource.statusCode,
        statusText: resource.statusText,
      }));
    }

    function getMcpRequestFromResources(
      resource: McpRequest,
    ): Extract<InsomniaFile, { type: 'mcpClient.insomnia/5.0' }>['mcpRequest'] {
      return {
        name: resource.name,
        url: resource.url,
        transportType: resource.transportType,
        headers: resource.headers,
        authentication: resource.authentication,
        meta: {
          id: resource._id,
          created: resource.created,
          modified: resource.modified,
        },
        env: resource.env.map(envVar => ({
          id: envVar.id,
          name: envVar.name,
          value: envVar.value,
          type: 'str',
          enabled: !!envVar.enabled,
        })),
        roots: resource.roots.map(root => ({
          uri: root.uri,
        })),
      };
    }

    if (workspace.scope === 'collection') {
      const collection: InsomniaFile = {
        type: 'collection.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        collection: getCollectionFromResources(
          exportableResources.filter(
            resource =>
              models.requestGroup.isRequestGroup(resource) ||
              models.request.isRequest(resource) ||
              models.webSocketRequest.isWebSocketRequest(resource) ||
              models.grpcRequest.isGrpcRequest(resource) ||
              models.socketIORequest.isSocketIORequest(resource),
          ),
          workspace._id,
        ),
        cookieJar: getCookieJarFromResources(exportableResources.filter(models.cookieJar.isCookieJar)),
        environments: getEnvironmentsFromResources(
          exportableResources.filter(models.environment.isEnvironment),
          includePrivateEnvironments,
        ),
      };

      const parsedCollection = InsomniaFileSchema.parse(collection);

      return stringify(removeEmptyFields(parsedCollection));
    } else if (workspace.scope === 'design') {
      const spec: InsomniaFile = {
        type: 'spec.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        collection: getCollectionFromResources(
          exportableResources.filter(
            resource =>
              models.requestGroup.isRequestGroup(resource) ||
              models.request.isRequest(resource) ||
              models.webSocketRequest.isWebSocketRequest(resource) ||
              models.grpcRequest.isGrpcRequest(resource),
          ),
          workspace._id,
        ),
        cookieJar: getCookieJarFromResources(exportableResources.filter(models.cookieJar.isCookieJar)),
        environments: getEnvironmentsFromResources(
          exportableResources.filter(models.environment.isEnvironment),
          includePrivateEnvironments,
        ),
        spec: getSpecFromResources(exportableResources.filter(models.apiSpec.isApiSpec)),
        testSuites: getTestSuitesFromResources(
          exportableResources.filter(
            resource => models.unitTestSuite.isUnitTestSuite(resource) || models.unitTest.isUnitTest(resource),
          ),
        ),
      };

      const parsedSpec = InsomniaFileSchema.parse(spec);

      return stringify(removeEmptyFields(parsedSpec));
    } else if (workspace.scope === 'environment') {
      const environment: InsomniaFile = {
        type: 'environment.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        environments: getEnvironmentsFromResources(
          exportableResources.filter(models.environment.isEnvironment),
          includePrivateEnvironments,
        ),
      };

      const parsedEnvironment = InsomniaFileSchema.parse(environment);

      return stringify(removeEmptyFields(parsedEnvironment));
    } else if (workspace.scope === 'mock-server') {
      const server = exportableResources.find(models.mockServer.isMockServer);
      invariant(server, 'Mock Server not found');
      const mockServer: InsomniaFile = {
        type: 'mock.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        server: {
          meta: {
            id: server._id,
            created: server.created,
            modified: server.modified,
            isPrivate: server.isPrivate,
          },
          url: server.url,
          useInsomniaCloud: server.useInsomniaCloud,
        },
        routes: getRoutesFromResources(exportableResources.filter(models.mockRoute.isMockRoute)),
      };

      const parsedMockServer = InsomniaFileSchema.parse(mockServer);
      return stringify(removeEmptyFields(parsedMockServer), {});
    } else if (workspace.scope === 'mcp') {
      const mcpRequest = exportableResources.find(models.mcpRequest.isMcpRequest);
      invariant(mcpRequest, 'No MCP Request found in MCP workspace');
      const mcpClient: InsomniaFile = {
        type: 'mcpClient.insomnia/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        // each mcp workspace has exactly one mcpRequest
        mcpRequest: getMcpRequestFromResources(mcpRequest),
        environments: getEnvironmentsFromResources(
          exportableResources.filter(models.environment.isEnvironment),
          includePrivateEnvironments,
        ),
      };

      const parsedMcpClient = InsomniaFileSchema.parse(mcpClient);

      return stringify(removeEmptyFields(parsedMcpClient));
    }
    throw new Error('Unknown workspace scope');
  } catch (err) {
    console.error('Failed to export Insomnia v5 data', err);
    return '';
  }
}
