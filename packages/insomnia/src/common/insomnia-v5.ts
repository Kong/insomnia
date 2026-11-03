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
  IDatabase,
  McpRequest,
  MockRoute,
  MockServer,
  Request,
  RequestBody,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  SocketIOPayload,
  SocketIORequest,
  UnitTest,
  UnitTestSuite,
  WebSocketPayload,
  WebSocketRequest,
  Workspace,
  WorkspaceScope,
} from 'insomnia-data';
import { EnvironmentKvPairDataType, EnvironmentType, models } from 'insomnia-data';
import { parse, stringify } from 'yaml';
import type { ZodType } from 'zod/v4';

import { type AllExportTypes, MODELS_BY_EXPORT_TYPE } from '~/common/import';
import { migrateToLatestYaml } from '~/common/insomnia-schema-migrations';
import { INSOMNIA_SCHEMA_VERSION } from '~/common/insomnia-schema-migrations/schema-version';
import { getKVPairFromData, maskVaultEnvironmentData } from '~/common/utils/environment-utils';
import { invariant } from '~/common/utils/invariant';

import { database } from './database';
import {
  CookieJarSchema,
  EnvironmentSchema,
  type Insomnia_GRPCRequest,
  type Insomnia_Request,
  type Insomnia_RequestGroup,
  type Insomnia_SocketIORequest,
  type Insomnia_WebsocketRequest,
  type InsomniaFile,
  InsomniaFileSchema,
  McpRequestSchema,
  type Meta,
  MockRouteSchema,
  RequestCollectionSchema,
  SocketIORequestSchema,
  SpecSchema,
  TestSuiteSchema,
  WebsocketRequestSchema,
} from './import-v5-parser';

/**
 * Type helper that adds the export type field to any BaseModel
 * This is used to ensure all exported models have the correct _type field for v5 format
 */
type WithExportType<T extends BaseModel> = T & { _type: AllExportTypes };

/** A single schema violation found on an entity that had to be skipped. */
export interface ExportEntityIssue {
  /** Path of the offending value, relative to the entity (e.g. `settings.followRedirects`). */
  path: string;
  message: string;
}

/** An entity that could not be exported, with the reason it was skipped. */
export interface ExportEntityError {
  entityId?: string;
  /** Insomnia model type as stored on the model, e.g. `Request`, `RequestGroup`, `Environment`. */
  entityType: string;
  name: string;
  /**
   * Where the entity sits in the export traversal, e.g. `collection[2].children[0]`. Skipped
   * siblings keep their original index, so a path can point past the last emitted entry.
   */
  path: string;
  issues: ExportEntityIssue[];
}

export interface InsomniaV5ExportResult {
  /** The exported YAML, or `''` when nothing could be exported. Never partially invalid. */
  yaml: string;
  /** Entities dropped from `yaml` because they failed the v5 schema. */
  errors: ExportEntityError[];
}

/** Identifies one exportable entity, used to report it if it has to be skipped. */
type ExportEntityIdentity = Omit<ExportEntityError, 'issues'>;

/** Renders a zod issue path (e.g. `collection[2].children[0].settings`) for humans. */
function formatPathSegments(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, segment) => (typeof segment === 'number' ? `${acc}[${segment}]` : acc ? `${acc}.${String(segment)}` : String(segment)),
    '',
  );
}

function toIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): ExportEntityIssue[] {
  return error.issues.map(issue => ({ path: formatPathSegments(issue.path), message: issue.message }));
}

/** Element schema of the collection tree: one request, folder, or other request type. */
const CollectionEntrySchema = RequestCollectionSchema.element;

/** Counts an entry and everything nested under it, for reporting what a dropped folder took with it. */
const countEntries = (entries: CollectionEntries | undefined): number =>
  (entries ?? []).reduce(
    (total, entry) => total + 1 + ('children' in entry ? countEntries(entry.children as CollectionEntries) : 0),
    0,
  );

/** The list of entries a collection document holds. */
type CollectionEntries = NonNullable<Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['collection']>;

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
 * Maps a payload document's metadata to v5 export format.
 *
 * Deliberately narrower than `mapMeta`: a payload has no description and no sort order, and
 * `filterEmptyValue` keeps `""`, `false` and `0`, so reusing `mapMeta` would add three
 * meaningless lines to every exported payload.
 */
function mapPayloadMeta(payload: SocketIOPayload | WebSocketPayload) {
  return {
    id: payload._id,
    created: payload.created,
    modified: payload.modified,
  };
}

/**
 * Maps a Socket.IO request's payload document to the v5 `body` field.
 *
 * Merely opening a Socket.IO request creates an empty payload document (via
 * `services.socketIOPayload.getOrCreateByParentId`), so an untouched payload is omitted
 * entirely — otherwise every repo would gain a spurious `body:` block and a git diff. This
 * cannot be delegated to `removeEmptyFields`, which preserves `""` and `false`.
 */
function mapSocketIOBody(payload?: SocketIOPayload): Insomnia_SocketIORequest['body'] {
  if (!payload) {
    return;
  }

  // Compared against the model's own defaults rather than just checking for empty values: an arg
  // the user added but left blank, or whose content type they changed, is real configuration.
  // Calling it untouched would drop it from the file and let `deleteOrphans` delete the payload
  // on the next sync. `init()` cannot be compared wholesale — it mints a fresh arg id each call.
  const defaults = models.socketIOPayload.init();
  const args = payload.args ?? [];
  const isUntouched =
    !payload.eventName &&
    !payload.ack &&
    args.length === defaults.args.length &&
    args.every((arg, index) => !arg.value && arg.mode === defaults.args[index].mode);

  if (isUntouched) {
    return;
  }

  return {
    meta: mapPayloadMeta(payload),
    eventName: payload.eventName ?? '',
    ack: payload.ack ?? false,
    // Emit every arg once any of them has content, so arg ids, order and per-arg mode survive
    args,
  };
}

/**
 * Maps a WebSocket request's payload document to the v5 `body` field. See `mapSocketIOBody`
 * for why an untouched payload is omitted.
 */
function mapWebSocketBody(payload?: WebSocketPayload): Insomnia_WebsocketRequest['body'] {
  if (!payload) {
    return;
  }

  const defaults = models.webSocketPayload.init();
  if (payload.name === defaults.name && payload.value === defaults.value && payload.mode === defaults.mode) {
    return;
  }

  return {
    meta: mapPayloadMeta(payload),
    name: payload.name,
    value: payload.value,
    mode: payload.mode,
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
 * v5 files carry an environment's variables only as `data`, so its KV rows -- and the isConfidential
 * flag that lives on them -- are rebuilt on import. `confidentialKeys` carries just the names of the
 * confidential variables so the flag survives export/import, Duplicate / Move and Git Sync.
 *
 * Mirrors getDataFromKVPair: only the last enabled row with a given name takes effect. Sorted so the
 * output is stable across import/export round-trips (canonical-file relies on that).
 */
function getConfidentialKeys(
  environmentType: EnvironmentType | undefined,
  kvPairData: EnvironmentKvPairData[] | undefined,
): string[] {
  if (environmentType !== EnvironmentType.KVPAIR || !kvPairData) {
    return [];
  }
  const isConfidentialByName = new Map<string, boolean>();
  for (const pair of kvPairData) {
    if (pair.enabled && pair.name) {
      isConfidentialByName.set(pair.name, !!pair.isConfidential);
    }
  }
  return [...isConfidentialByName]
    .filter(([, isConfidential]) => isConfidential)
    .map(([name]) => name)
    .sort();
}

/**
 * Inverse of getConfidentialKeys: rebuilds the KV rows from `data` and flags the confidential ones.
 * Confidential flags only exist in the table view, so the environment is restored as KVPAIR.
 * Without confidentialKeys nothing is added, which keeps the import unchanged for every other file.
 */
function getKvPairFieldsFromConfidentialKeys(
  data: Record<string, any>,
  dataPropertyOrder: Record<string, any> | null | undefined,
  confidentialKeys: string[] | undefined,
): { environmentType?: EnvironmentType; kvPairData?: EnvironmentKvPairData[] } {
  if (!confidentialKeys?.length) {
    return {};
  }
  const confidentialNames = new Set(confidentialKeys);
  return {
    environmentType: EnvironmentType.KVPAIR,
    kvPairData: getKVPairFromData(data, dataPropertyOrder ?? null).map(pair => ({
      ...pair,
      isConfidential: confidentialNames.has(pair.name),
    })),
  };
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
    // The legacy spec type is treated as collection scope for now. We keep the spec type for backward compatibility.
    return 'collection';
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
    name: file.name || 'Imported API Collection',
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
      ...getKvPairFieldsFromConfidentialKeys(
        (file.environments.data as Record<string, any>) || {},
        file.environments.dataPropertyOrder,
        file.environments.confidentialKeys,
      ),
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
        ...getKvPairFieldsFromConfidentialKeys(
          (environment.data as Record<string, any>) || {},
          environment.dataPropertyOrder,
          environment.confidentialKeys,
        ),
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
    // The `{ contents }` shape of the v5 spec format does not carry
    // ApiSpec.fileName. Fall back to the file name so a git round-trip does
    // not blank it out and trigger repair-database to rewrite (and restamp
    // `modified` of) every spec.
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
        fileName: ('file' in file.spec ? file.spec.file : undefined) || file.name || '',
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
  // Now both legacy spec and new api collection files could contain legacy unit tests
  if (file.type === 'spec.insomnia.rest/5.0' || file.type === 'collection.insomnia.rest/5.0') {
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

/**
 * Tells a Socket.IO collection node apart from a WebSocket one.
 *
 * `WebsocketRequestSchema.safeParse` cannot do this on its own: once `metaSortKey` is
 * destructured out neither schema has a required field, and `z.object` strips unknown keys, so a
 * Socket.IO item parses cleanly as a WebSocket request and silently loses its `eventListeners`
 * and `body`. The `z.undefined()` guards on `RequestCollectionSchema` keep the two apart inside
 * the union, but `walkCollection` routes with the base schemas, so it needs its own check.
 *
 * `meta.id` is authoritative when present — every Insomnia-generated file has it. Otherwise fall
 * back to keys only one of the two can carry. An item with none of them is genuinely
 * indistinguishable and stays on the WebSocket branch, as it did before.
 */
function isSocketIOCollectionNode(item: Record<string, any>): boolean {
  if (models.socketIORequest.isSocketIORequestId(item.meta?.id)) {
    return true;
  }
  if (models.webSocketRequest.isWebSocketRequestId(item.meta?.id)) {
    return false;
  }
  if (item.eventListeners || item.settings?.path !== undefined) {
    return true;
  }
  const body = item.body;
  return Boolean(body && ('eventName' in body || 'ack' in body || 'args' in body));
}

function getCollection(
  file: InsomniaFile,
): (Request | WebSocketRequest | WebSocketPayload | SocketIORequest | SocketIOPayload | GrpcRequest | RequestGroup)[] {
  if (file.type === 'collection.insomnia.rest/5.0' || file.type === 'spec.insomnia.rest/5.0') {
    const resources: (Request | WebSocketRequest | WebSocketPayload | SocketIORequest | SocketIOPayload | GrpcRequest | RequestGroup)[] = [];

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
            ...getKvPairFieldsFromConfidentialKeys(
              (item.environment as Record<string, any>) || {},
              item.environmentPropertyOrder,
              item.confidentialKeys,
            ),
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
          if (wbRequest.success && !isSocketIOCollectionNode(item)) {
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

            if (data.body) {
              const webSocketPayload: WithExportType<WebSocketPayload> = {
                // Derived from the owning request's id rather than a shared literal placeholder:
                // `importResourcesToNewWorkspace` keys its id map by `_id`, so a shared one would
                // collapse every payload in the file into a single document.
                //
                // It must also carry the model's own prefix. Git Sync persists this `_id`
                // verbatim, and the next export validates it against `WebsocketRequestBodySchema`
                // — a non-conforming id throws there, which empties the export and silently stops
                // db-to-fs sync for the whole workspace.
                ...mapMetaToInsomniaMeta(
                  data.body.meta || {
                    id: `${models.webSocketPayload.prefix}_${websocketRequest._id}`,
                  },
                ),
                type: 'WebSocketPayload',
                _type: 'websocket_payload',
                // Must be the request's id as it appears in this same flat array, so that the
                // import's second pass can resolve it through the id map
                parentId: websocketRequest._id,
                name: data.body.name,
                value: data.body.value,
                mode: data.body.mode,
              };

              resources.push(webSocketPayload);
            }
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

              if (data.body) {
                const socketIOPayload: WithExportType<SocketIOPayload> = {
                  // See the WebSocket payload above for why the id is prefixed and derived from
                  // the owning request
                  ...mapMetaToInsomniaMeta(
                    data.body.meta || {
                      id: `${models.socketIOPayload.prefix}_${socketIO._id}`,
                    },
                  ),
                  type: 'SocketIOPayload',
                  _type: 'socketio_payload',
                  parentId: socketIO._id,
                  // A Socket.IO payload has no user-facing name; '' is the base model's default
                  name: '',
                  eventName: data.body.eventName,
                  ack: data.body.ack,
                  args: data.body.args,
                };

                resources.push(socketIOPayload);
              }
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
      return [
        getWorkspace(file),
        ...getEnvironments(file),
        ...getCookieJar(file),
        ...getCollection(file),
        ...getApiSpec(file),
        ...getTestSuites(file),
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
 * Entities that do not match the v5 schema are dropped from the result and reported in
 * `errors`, so one bad request no longer costs the whole export. When nothing usable could
 * be exported — or when the assembled document still fails the schema — `yaml` is `''` and
 * callers must not write a file.
 *
 * @param workspaceId - ID of the workspace to export
 * @param includePrivateEnvironments - Whether to include private environment data
 * @param requestIds - Optional array of specific request IDs to export (if not provided, exports all)
 * @param db - Database to read from (defaults to the app database)
 * @returns The exported YAML and the entities that had to be skipped
 */
export async function getInsomniaV5DataExport({
  workspaceId,
  includePrivateEnvironments,
  requestIds,
  db = database,
}: {
  workspaceId: string;
  includePrivateEnvironments: boolean;
  requestIds?: string[];
  db?: IDatabase;
}): Promise<InsomniaV5ExportResult> {
  const errors: ExportEntityError[] = [];

  /** Fails the whole export, e.g. when the workspace holds nothing left to fall back on. */
  const fail = (identity: ExportEntityIdentity, message: string): InsomniaV5ExportResult => {
    errors.push({ ...identity, issues: [{ path: '', message }] });
    return { yaml: '', errors };
  };

  // Reported in the catch-all below; stays the raw id while the workspace is still unknown.
  let workspaceName = workspaceId;

  try {
    // Read through `db` rather than `services.workspace.getById`: services always use the app database,
    // so they would miss the workspace when exporting from another database (e.g. a scratch in-memory one)
    const workspace = await db.findOne<Workspace>(models.workspace.type, { _id: workspaceId });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    workspaceName = workspace.name;

    /**
     * Runs a whole-document schema check as a last line of defence. Anything still invalid
     * here was not isolated by the code above, so the export yields nothing rather than a
     * file that only looks complete.
     */
    const finalize = (doc: InsomniaFile, emptySpecSection = false): InsomniaV5ExportResult => {
      const parsed = InsomniaFileSchema.safeParse(doc);

      if (!parsed.success) {
        errors.push({
          entityId: workspace._id,
          entityType: models.workspace.type,
          name: workspace.name,
          path: '',
          issues: toIssues(parsed.error),
        });
        return { yaml: '', errors };
      }

      const cleaned = removeEmptyFields(parsed.data);
      // removeEmptyFields drops an empty spec, but a legacy design document should
      // keep the section so it round-trips like the importer's default.
      if (emptySpecSection) {
        cleaned.spec = { contents: {} };
      }

      return { yaml: stringify(cleaned), errors };
    };

    /**
     * Validates one entity on its own. Returns `undefined` and reports the entity when it
     * does not match the schema.
     */
    function parseEntity<T>(schema: ZodType<T>, value: unknown, identity: ExportEntityIdentity): T | undefined {
      const parsed = schema.safeParse(value);

      if (parsed.success) {
        return parsed.data;
      }

      errors.push({ ...identity, issues: toIssues(parsed.error) });
      return undefined;
    }

    /**
     * Builds and validates a whole section (environments, cookieJar, spec, ...) as one unit.
     * A section that cannot be built, or that fails the schema, is dropped from the export
     * and reported, so that the remaining entities are still exported.
     */
    function parseSection<T>(build: () => unknown, schema: ZodType<T>, identity: ExportEntityIdentity): T | undefined {
      let value: unknown;

      try {
        value = build();
      } catch (err) {
        errors.push({
          ...identity,
          issues: [{ path: '', message: err instanceof Error ? err.message : String(err) }],
        });
        return undefined;
      }

      if (value === undefined) {
        return undefined;
      }

      return parseEntity(schema, value, identity);
    }

    // Get all model types that can be exported
    const exportableTypes = Object.values(MODELS_BY_EXPORT_TYPE);

    // Fetch all descendants of the workspace (requests, folders, environments, etc.)
    const workspaceDescendants = await db.getWithDescendants(workspace, exportableTypes);

    // Filter to only include resources that are exportable
    const exportableResources = workspaceDescendants.filter(resource => {
      if (exportableTypes.includes(resource.type)) {
        return true;
      }

      return false;
    });

    // Payload documents are children of their request rather than collection nodes of their own,
    // so they are looked up by parentId while building the owning request's node, and are never
    // passed to `getCollectionFromResources`.
    const socketIOPayloadsByRequestId = new Map(
      exportableResources.filter(models.socketIOPayload.isSocketIOPayload).map(payload => [payload.parentId, payload]),
    );
    const webSocketPayloadsByRequestId = new Map(
      exportableResources.filter(models.webSocketPayload.isWebSocketPayload).map(payload => [payload.parentId, payload]),
    );

    /**
     * Recursively builds a collection structure from flat resource list
     * This function converts the flat list of resources into a hierarchical structure
     * that matches the v5 export format with proper parent-child relationships
     *
     * Every entry is validated on its own against the v5 schema. An entry that fails is
     * dropped (together with its subtree, for folders) and reported through `errors`, so
     * that the remaining requests are still exported.
     *
     * @param resources - Flat array of all resources in the workspace
     * @param parentId - ID of the parent to build children for
     * @param parentPath - Document location of this level, used to report skipped entries
     * @returns Hierarchical collection structure in v5 format
     */
    function getCollectionFromResources(
      resources: (Request | RequestGroup | WebSocketRequest | GrpcRequest | SocketIORequest)[],
      parentId: string,
      parentPath: string,
    ): CollectionEntries {
      const collection: CollectionEntries = [];

      /** Validates one entry and pushes it, or reports it as skipped. */
      const pushEntry = (
        entry:
          | Insomnia_Request
          | Insomnia_RequestGroup
          | Insomnia_WebsocketRequest
          | Insomnia_SocketIORequest
          | Insomnia_GRPCRequest,
        resource: Request | RequestGroup | WebSocketRequest | GrpcRequest | SocketIORequest,
        path: string,
        children?: CollectionEntries,
      ) => {
        const parsed = CollectionEntrySchema.safeParse(entry);

        if (parsed.success) {
          collection.push(parsed.data);
          return;
        }

        const skippedDescendants = countEntries(children);

        errors.push({
          entityId: resource._id,
          entityType: resource.type,
          name: resource.name,
          path,
          issues: [
            ...toIssues(parsed.error),
            // A folder carries its whole subtree, so say what else went with it.
            ...(skippedDescendants > 0
              ? [
                  {
                    path: '',
                    message: `skipped together with ${skippedDescendants} nested ${
                      skippedDescendants === 1 ? 'entity' : 'entities'
                    }`,
                  },
                ]
              : []),
          ],
        });
      };

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
        .forEach((resource, index) => {
          const path = `${parentPath}[${index}]`;

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
            pushEntry(request, resource, path);
          } else if (models.requestGroup.isRequestGroup(resource)) {
            // Convert request groups (folders) to v5 format
            const children = getCollectionFromResources(resources, resource._id, `${path}.children`); // Recursively build children
            const requestGroup: Insomnia_RequestGroup = {
              name: resource.name,
              meta: mapGroupMeta(resource),
              children,
              scripts: getScriptFromResources(resource),
              authentication: resource.authentication,
              environment: resource.environment,
              environmentPropertyOrder: resource.environmentPropertyOrder,
              confidentialKeys: getConfidentialKeys(resource.environmentType, resource.kvPairData),
              headers: mapHeaders(resource.headers),
            };
            pushEntry(requestGroup, resource, path, children);
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
                useProxy: resource.settingUseProxy,
              },
              authentication: resource.authentication,
              headers: mapHeaders(resource.headers),
              parameters: mapParameters(resource.parameters),
              pathParameters: resource.pathParameters,
              body: mapWebSocketBody(webSocketPayloadsByRequestId.get(resource._id)),
            };
            pushEntry(webSocketRequest, resource, path);
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
              body: mapSocketIOBody(socketIOPayloadsByRequestId.get(resource._id)),
            };
            pushEntry(socketIORequest, resource, path);
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
            pushEntry(grpcRequest, resource, path);
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
      baseEnvironment: Environment | undefined,
    ): Extract<InsomniaFile, { type: 'collection.insomnia.rest/5.0' }>['environments'] {
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
        confidentialKeys: getConfidentialKeys(baseEnvironment.environmentType, baseEnvironment.kvPairData),
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
          confidentialKeys: getConfidentialKeys(subEnvironment.environmentType, subEnvironment.kvPairData),
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

    /**
     * Test suites are an optional section, like environments: a suite that fails
     * validation is dropped and reported but does not abort the rest of the export.
     */
    function getTestSuitesFromResources(
      resources: (UnitTestSuite | UnitTest)[],
    ): Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['testSuites'] {
      const testSuites: Extract<InsomniaFile, { type: 'spec.insomnia.rest/5.0' }>['testSuites'] = [];

      resources.filter(models.unitTestSuite.isUnitTestSuite).forEach((testSuite, index) => {
        const tests = resources.filter(models.unitTest.isUnitTest).filter(test => test.parentId === testSuite._id);

        const parsed = parseEntity(
          TestSuiteSchema,
          {
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
          },
          {
            entityId: testSuite._id,
            entityType: testSuite.type,
            name: testSuite.name,
            path: `testSuites[${index}]`,
          },
        );

        if (parsed) {
          testSuites.push(parsed);
        }
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
    ): NonNullable<Extract<InsomniaFile, { type: 'mock.insomnia.rest/5.0' }>['routes']> {
      const routes: NonNullable<Extract<InsomniaFile, { type: 'mock.insomnia.rest/5.0' }>['routes']> = [];

      resources.forEach((resource, index) => {
        const parsed = parseEntity(
          MockRouteSchema,
          {
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
          },
          {
            entityId: resource._id,
            entityType: resource.type,
            name: resource.name,
            path: `routes[${index}]`,
          },
        );

        if (parsed) {
          routes.push(parsed);
        }
      });

      return routes;
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
          type: EnvironmentKvPairDataType.STRING,
          enabled: !!envVar.enabled,
        })),
        roots: resource.roots.map(root => ({
          uri: root.uri,
        })),
      };
    }

    const environmentResources = exportableResources.filter(models.environment.isEnvironment);
    // The base environment lives directly under the workspace; the rest hang off the base one.
    const baseEnvironment = environmentResources.find(environment => environment.parentId.startsWith('wrk_'));
    const environmentsIdentity: ExportEntityIdentity = {
      entityId: baseEnvironment?._id,
      entityType: models.environment.type,
      name: baseEnvironment?.name || workspace.name,
      path: 'environments',
    };
    const cookieJarResources = exportableResources.filter(models.cookieJar.isCookieJar);
    const cookieJarIdentity: ExportEntityIdentity = {
      entityId: cookieJarResources[0]?._id,
      entityType: models.cookieJar.type,
      name: cookieJarResources[0]?.name || workspace.name,
      path: 'cookieJar',
    };
    const apiSpecResources = exportableResources.filter(models.apiSpec.isApiSpec);
    const apiSpecIdentity: ExportEntityIdentity = {
      entityId: apiSpecResources[0]?._id,
      entityType: models.apiSpec.type,
      name: apiSpecResources[0]?.name || workspace.name,
      path: 'spec',
    };
    /**
     * Environments are optional outside the environment scope. A workspace with none is a
     * valid export; only environment data without a base environment is a section error.
     */
    const getOptionalEnvironments = () =>
      environmentResources.length > 0
        ? getEnvironmentsFromResources(environmentResources, includePrivateEnvironments, baseEnvironment)
        : undefined;

    if (workspace.scope === 'collection') {
      const collectionTestSuites = exportableResources.filter(
        resource => models.unitTestSuite.isUnitTestSuite(resource) || models.unitTest.isUnitTest(resource),
      );
      const collectionContainsApiSpecOrTestSuites = apiSpecResources.length > 0 || collectionTestSuites.length > 0;
      const collectionResources = exportableResources.filter(
        resource =>
          models.requestGroup.isRequestGroup(resource) ||
          models.request.isRequest(resource) ||
          models.webSocketRequest.isWebSocketRequest(resource) ||
          models.grpcRequest.isGrpcRequest(resource) ||
          models.socketIORequest.isSocketIORequest(resource),
      );

      const errorsBeforeCollection = errors.length;
      const collection = getCollectionFromResources(collectionResources, workspace._id, 'collection');

      // Requests are what the file is for: exporting none of them would look like a success
      // while wiping the collection on the next import.
      if (collection.length === 0 && errors.length > errorsBeforeCollection) {
        return { yaml: '', errors };
      }

      const specSection =
        apiSpecResources.length > 0
          ? parseSection(() => getSpecFromResources(apiSpecResources), SpecSchema, apiSpecIdentity)
          : undefined;

      const collectionSections = {
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        collection,
        cookieJar: parseSection(() => getCookieJarFromResources(cookieJarResources), CookieJarSchema, cookieJarIdentity),
        environments: parseSection(getOptionalEnvironments, EnvironmentSchema, environmentsIdentity),
        testSuites: getTestSuitesFromResources(collectionTestSuites),
      };

      // We added api spec and test suites to the collection workspace in V13.3.
      // In order not to break legacy versions which only handles api spec and test suites in the spec workspace for git sync.
      // We export collection workspaces type as spec.insomnia.rest/5.0 if it contains api spec or test suites.
      if (collectionContainsApiSpecOrTestSuites) {
        return finalize({ type: 'spec.insomnia.rest/5.0', ...collectionSections, spec: specSection ?? {} });
      }

      return finalize({ type: 'collection.insomnia.rest/5.0', ...collectionSections, spec: specSection });
    } else if (workspace.scope === 'design') {
      // Legacy design workspaces can lose their spec. Export the rest instead of
      // failing the workspace: the importer treats a missing spec as an empty one.
      const specSection =
        apiSpecResources.length > 0
          ? parseSection(() => getSpecFromResources(apiSpecResources), SpecSchema, apiSpecIdentity)
          : undefined;

      const errorsBeforeCollection = errors.length;
      const designCollection = getCollectionFromResources(
        exportableResources.filter(
          resource =>
            models.requestGroup.isRequestGroup(resource) ||
            models.request.isRequest(resource) ||
            models.webSocketRequest.isWebSocketRequest(resource) ||
            models.grpcRequest.isGrpcRequest(resource) ||
            models.socketIORequest.isSocketIORequest(resource),
        ),
        workspace._id,
        'collection',
      );

      // Same guard as the collection scope: exporting none of the requests would look like
      // a success while wiping them on the next import.
      if (designCollection.length === 0 && errors.length > errorsBeforeCollection) {
        return { yaml: '', errors };
      }

      const specDoc: InsomniaFile = {
        type: 'spec.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        collection: designCollection,
        cookieJar: parseSection(
          () => getCookieJarFromResources(cookieJarResources),
          CookieJarSchema,
          cookieJarIdentity,
        ),
        environments: parseSection(getOptionalEnvironments, EnvironmentSchema, environmentsIdentity),
        spec: specSection ?? {},
        testSuites: getTestSuitesFromResources(
          exportableResources.filter(
            resource => models.unitTestSuite.isUnitTestSuite(resource) || models.unitTest.isUnitTest(resource),
          ),
        ),
      };

      return finalize(specDoc, apiSpecResources.length === 0);
    } else if (workspace.scope === 'environment') {
      const environments = parseSection(
        () => getEnvironmentsFromResources(environmentResources, includePrivateEnvironments, baseEnvironment),
        EnvironmentSchema,
        environmentsIdentity,
      );

      // The environment is the whole document; without it the export would be empty.
      if (!environments) {
        return { yaml: '', errors };
      }

      const environmentDoc: InsomniaFile = {
        type: 'environment.insomnia.rest/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        environments,
      };

      return finalize(environmentDoc);
    } else if (workspace.scope === 'mock-server') {
      const server = exportableResources.find(models.mockServer.isMockServer);
      invariant(server, 'Mock Server not found');
      const mockRouteResources = exportableResources.filter(models.mockRoute.isMockRoute);

      const errorsBeforeRoutes = errors.length;
      const routes = getRoutesFromResources(mockRouteResources);

      // Same as the collection case: a mock server file without routes is not a success.
      if (routes.length === 0 && errors.length > errorsBeforeRoutes) {
        return { yaml: '', errors };
      }

      const mockServerDoc: InsomniaFile = {
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
        routes,
      };

      return finalize(mockServerDoc);
    } else if (workspace.scope === 'mcp') {
      const mcpRequest = exportableResources.find(models.mcpRequest.isMcpRequest);
      invariant(mcpRequest, 'No MCP Request found in MCP workspace');
      const mcpRequestSection = parseSection(
        () => getMcpRequestFromResources(mcpRequest),
        McpRequestSchema,
        {
          entityId: mcpRequest._id,
          entityType: mcpRequest.type,
          name: mcpRequest.name || workspace.name,
          path: 'mcpRequest',
        },
      );

      // Each mcp workspace holds exactly one request, which is the whole document.
      if (!mcpRequestSection) {
        return { yaml: '', errors };
      }

      const mcpClientDoc: InsomniaFile = {
        type: 'mcpClient.insomnia/5.0',
        schema_version: INSOMNIA_SCHEMA_VERSION,
        name: workspace.name,
        meta: mapWorkspaceMeta(workspace),
        // each mcp workspace has exactly one mcpRequest
        mcpRequest: mcpRequestSection,
        environments: parseSection(getOptionalEnvironments, EnvironmentSchema, environmentsIdentity),
      };

      return finalize(mcpClientDoc);
    }
    throw new Error('Unknown workspace scope');
  } catch (err) {
    console.error('Failed to export Insomnia v5 data', err);
    return fail(
      { entityId: workspaceId, entityType: models.workspace.type, name: workspaceName, path: '' },
      err instanceof Error ? err.message : String(err),
    );
  }
}
