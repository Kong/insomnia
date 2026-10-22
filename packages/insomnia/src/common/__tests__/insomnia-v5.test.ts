/**
 * Comprehensive tests for Insomnia v5 import/export functionality
 *
 * This test suite covers all the functions we added comments to in insomnia-v5.ts,
 * ensuring they work correctly and handle edge cases properly.
 */

import type { Request } from 'insomnia-data';
import { EnvironmentKvPairDataType, EnvironmentType, services } from 'insomnia-data';
import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { INSOMNIA_SCHEMA_VERSION } from '../../common/insomnia-schema-migrations/schema-version';
import { database as db } from '../database';
import {
  getInsomniaV5DataExport,
  importInsomniaV5Data,
  insomniaSchemaTypeToScope,
  tryImportV5Data,
} from '../insomnia-v5';

// @vitest-environment jsdom
describe('Insomnia v5 Import/Export - Comprehensive Tests', () => {
  beforeEach(async () => {
    // Initialize the in-memory database
    await db.init({ inMemoryOnly: true });

    // Create a basic project and workspace
    await services.project.create({
      _id: 'proj_test',
      name: 'Test Project',
    });

    await services.workspace.create({
      _id: 'wrk_test',
      name: 'Test Workspace',
      parentId: 'proj_test',
      scope: 'collection',
    });

    await services.settings.getOrCreate();
  });

  describe('insomniaSchemaTypeToScope', () => {
    it('maps v5 schema types to workspace scopes', () => {
      expect(insomniaSchemaTypeToScope('collection.insomnia.rest/5.0')).toBe('collection');
      expect(insomniaSchemaTypeToScope('environment.insomnia.rest/5.0')).toBe('environment');
      expect(insomniaSchemaTypeToScope('spec.insomnia.rest/5.0')).toBe('collection');
      expect(insomniaSchemaTypeToScope('mock.insomnia.rest/5.0')).toBe('mock-server');
      expect(insomniaSchemaTypeToScope('mcpClient.insomnia/5.0')).toBe('mcp');
    });
  });

  describe('tryImportV5Data', () => {
    it('successfully imports valid v5 collection data', () => {
      const validV5Data = `
type: collection.insomnia.rest/5.0
name: Test Collection
meta:
  id: wrk_test
  created: 1234567890
  modified: 1234567890
collection:
  - name: Test Request
    url: https://api.example.com/test
    method: GET
    meta:
      id: req_test
      created: 1234567890
      modified: 1234567890
`;

      const result = tryImportV5Data(validV5Data);

      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        _id: 'wrk_test',
        name: 'Test Collection',
        type: 'Workspace',
        _type: 'workspace',
      });
    });

    it('handles invalid YAML gracefully', () => {
      const invalidData = 'invalid yaml content';
      const result = tryImportV5Data(invalidData);

      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('handles malformed YAML gracefully', () => {
      const malformedData = `
type: collection.insomnia.rest/5.0
name: Test Collection
invalid: [unclosed array
`;
      const result = tryImportV5Data(malformedData);
      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
    });

    it('handles unsupported or future schema gracefully', () => {
      const futureSchemaData = `
type: futureCollection.insomnia.rest/5.0
name: Future Schema Collection
meta:
  id: wrk_test
  created: 1234567890
  modified: 1234567890
`;
      const result = tryImportV5Data(futureSchemaData);
      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('importInsomniaV5Data', () => {
    it('returns empty array on invalid data', () => {
      const invalidData = 'invalid yaml content';
      const result = importInsomniaV5Data(invalidData);
      expect(result).toEqual([]);
    });

    it('returns empty array on unsupported or future data', () => {
      const futureSchemaData = `
type: futureCollection.insomnia.rest/5.0
name: Future Schema Collection
meta:
  id: wrk_test
  created: 1234567890
  modified: 1234567890
`;
      const result = importInsomniaV5Data(futureSchemaData);
      expect(result).toEqual([]);
    });

    it('returns parsed data on valid input', () => {
      const validV5Data = `
type: collection.insomnia.rest/5.0
name: Test Collection
meta:
  id: wrk_test
collection: []
`;
      const result = importInsomniaV5Data(validV5Data);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        _id: 'wrk_test',
        name: 'Test Collection',
        type: 'Workspace',
      });
    });

    it('fills the apiSpec fileName from the design document name', () => {
      const designDocData = `
type: spec.insomnia.rest/5.0
name: My Design Document
meta:
  id: wrk_test
spec:
  contents:
    openapi: 3.0.0
    info:
      title: Test Spec
      version: 1.0.0
`;
      const result = importInsomniaV5Data(designDocData);
      const apiSpec = result.find(r => r.type === 'ApiSpec');
      // The v5 spec format does not serialize ApiSpec.fileName; without this
      // fallback every git round-trip blanks it out and repair-database
      // restamps `modified` of every design document on startup.
      expect(apiSpec).toMatchObject({ fileName: 'My Design Document' });
    });

    it('uses spec.file as the apiSpec fileName when present', () => {
      const specData = `
type: spec.insomnia.rest/5.0
name: My Design Document
meta:
  id: wrk_test
spec:
  file: my-spec.yaml
  meta:
    id: spc_test
`;
      const result = importInsomniaV5Data(specData);
      const apiSpec = result.find(r => r.type === 'ApiSpec');
      expect(apiSpec).toMatchObject({ fileName: 'my-spec.yaml' });
    });

    it('falls back to the design document name when spec.file is empty', () => {
      const specData = `
type: spec.insomnia.rest/5.0
name: My Design Document
meta:
  id: wrk_test
spec:
  file: ''
  meta:
    id: spc_test
`;
      const result = importInsomniaV5Data(specData);
      const apiSpec = result.find(r => r.type === 'ApiSpec');
      // fileName '' is indistinguishable from "not set" for repair-database;
      // falling back here avoids a pointless restamp of `modified` on startup.
      expect(apiSpec).toMatchObject({ fileName: 'My Design Document' });
    });
  });

  describe('getInsomniaV5DataExport', () => {
    it('exports workspace with requests correctly', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_export_test',
        name: 'Export Test Workspace',
        parentId: 'proj_test',
        created: 1_234_567_890,
        modified: 1_234_567_890,
        description: 'Test workspace for export',
        scope: 'collection',
      });

      await services.request.create({
        _id: 'req_export_test',
        name: 'Export Test Request',
        parentId: workspace._id,
        url: 'https://api.example.com/test',
        method: 'GET',
        headers: [{ name: 'Content-Type', value: 'application/json' }],
        parameters: [{ name: 'param1', value: 'value1' }],
        metaSortKey: 0,
      });

      // Add base environment (required)
      await services.environment.create({
        _id: 'env_export_test',
        name: 'Base Environment',
        parentId: workspace._id,
        data: { api_url: 'https://api.example.com' },
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(parsed.type).toBe('collection.insomnia.rest/5.0');
      expect(parsed.schema_version).toBe(INSOMNIA_SCHEMA_VERSION);
      expect(parsed.collection).toHaveLength(1);
      expect(parsed.collection[0]).toMatchObject({
        name: 'Export Test Request',
        url: 'https://api.example.com/test',
        method: 'GET',
      });
    });

    // Check exported key order for workspaces
    it.each(['collection', 'design', 'environment'] as const)(
      'exports environments with a stable key order for %s scope',
      async scope => {
        const workspace = await services.workspace.create({
          _id: `wrk_env_order_${scope}`,
          name: 'Env Order Workspace',
          parentId: 'proj_test',
          scope,
        });

        const baseEnvironment = await services.environment.create({
          _id: `env_base_${scope}`,
          name: 'Base Environment',
          parentId: workspace._id,
          data: { api_url: 'https://api.example.com' },
          color: '#ff0000',
        });
        await services.environment.create({
          _id: `env_sub_${scope}`,
          name: 'Sub Environment',
          parentId: baseEnvironment._id,
          data: { api_url: 'https://sub.example.com' },
          color: '#00ff00',
        });

        if (scope === 'design') {
          await services.apiSpec.getOrCreateForParentId(workspace._id, {
            _id: 'spec_env_order',
            contents: '{"openapi": "3.0.0"}',
            contentType: 'json',
          });
        }

        const result = await getInsomniaV5DataExport({
          workspaceId: workspace._id,
          includePrivateEnvironments: false,
        });

        const { environments } = YAML.parse(result);
        expect(Object.keys(environments)).toEqual(['name', 'meta', 'data', 'color', 'subEnvironments']);
        expect(Object.keys(environments.subEnvironments[0])).toEqual(['name', 'meta', 'data', 'color']);
      },
    );

    it('handles empty workspace gracefully', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_empty_test',
        name: 'Empty Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      // must add a base environment
      await services.environment.create({
        _id: 'env_empty',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(parsed.type).toBe('collection.insomnia.rest/5.0');
      expect(parsed.collection ?? []).toEqual([]);
    });

    it('filters requests when requestIds are provided', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_filter_test',
        name: 'Filter Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      await services.environment.create({
        _id: 'env_filter',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      const req1 = await services.request.create({
        _id: 'req_filter_1',
        name: 'Request 1',
        parentId: workspace._id,
        url: 'https://api.example.com/1',
        method: 'GET',
      });

      await services.request.create({
        _id: 'req_filter_2',
        name: 'Request 2',
        parentId: workspace._id,
        url: 'https://api.example.com/2',
        method: 'GET',
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
        requestIds: [req1._id],
      });

      const parsed = YAML.parse(result);
      expect(parsed.collection).toHaveLength(1);
      expect(parsed.collection[0].name).toBe('Request 1');
    });

    it('handles design workspace correctly', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_design_test',
        name: 'Design Workspace',
        parentId: 'proj_test',
        scope: 'design',
      });

      await services.environment.create({
        _id: 'env_design',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      await services.apiSpec.getOrCreateForParentId(workspace._id, {
        _id: 'spec_design',
        contents: '{"openapi": "3.0.0"}',
        contentType: 'json',
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(parsed.type).toBe('spec.insomnia.rest/5.0');
      expect(parsed.spec).toBeDefined();
    });

    // A Socket.IO request used to be dropped from a design doc's export, which in a Git Sync
    // project meant `deleteOrphans` removed the request itself on the next sync
    it('exports Socket.IO requests from a design workspace', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_design_socketio',
        name: 'Design Workspace',
        parentId: 'proj_test',
        scope: 'design',
      });
      await services.environment.create({
        _id: 'env_design_socketio',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });
      await services.apiSpec.getOrCreateForParentId(workspace._id, {
        _id: 'spec_design_socketio',
        contents: '{"openapi": "3.0.0"}',
        contentType: 'json',
      });
      await services.socketIORequest.create({
        _id: 'socketio-req_design',
        name: 'design-socketio',
        parentId: workspace._id,
        url: 'https://socket.example.com',
        metaSortKey: 1,
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(parsed.collection.map((item: { name: string }) => item.name)).toContain('design-socketio');
    });

    it('handles mock server scope', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_mock',
        name: 'Mock Workspace',
        parentId: 'proj_test',
        scope: 'mock-server',
      });

      await services.mockServer.create({
        _id: 'mock_1',
        name: 'Test Server',
        parentId: workspace._id,
        url: 'http://localhost:3000',
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(parsed.type).toBe('mock.insomnia.rest/5.0');
      expect(parsed.server.url).toBe('http://localhost:3000');
    });

    // Check exported key order for mock server and routes
    it('exports mock server and mock routes with a stable key order', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_mock_order',
        name: 'Mock Order Workspace',
        parentId: 'proj_test',
        scope: 'mock-server',
      });

      const server = await services.mockServer.create({
        _id: 'mock_order',
        name: 'Order Server',
        parentId: workspace._id,
        url: 'http://localhost:3000',
        useInsomniaCloud: false,
      });

      await services.mockRoute.create({
        _id: 'route_order',
        name: '/ping',
        parentId: server._id,
        body: '{"ok":true}',
        headers: [{ name: 'X-Mock', value: '1', description: 'mock header', disabled: false }],
        method: 'GET',
        mimeType: 'application/json',
        statusCode: 201,
        statusText: 'Created',
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      expect(Object.keys(parsed)).toEqual(['type', 'schema_version', 'name', 'meta', 'server', 'routes']);
      expect(Object.keys(parsed.server)).toEqual(['meta', 'url', 'useInsomniaCloud']);
      expect(parsed.routes).toHaveLength(1);
      expect(Object.keys(parsed.routes[0])).toEqual([
        'name',
        'meta',
        'body',
        'headers',
        'method',
        'mimeType',
        'statusCode',
        'statusText',
      ]);
      expect(Object.keys(parsed.routes[0].headers[0])).toEqual(['name', 'value', 'description', 'disabled']);
    });

    it('handles mcp client scope', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_mcp',
        name: 'MCP Workspace',
        parentId: 'proj_test',
        scope: 'mcp',
      });

      await services.environment.create({
        _id: 'env_mcp',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      const mcpRequest = await services.mcpRequest.create({
        _id: 'mcp-request_test',
        name: 'Test MCP client',
        parentId: workspace._id,
        url: 'http://mcp.test.com/mcp',
        transportType: 'streamable-http',
      });

      let result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      let parsed = YAML.parse(result);
      expect(parsed.type).toBe('mcpClient.insomnia/5.0');
      expect(parsed.mcpRequest.url).toBe('http://mcp.test.com/mcp');
      expect(parsed.mcpRequest.transportType).toBe('streamable-http');

      await services.mcpRequest.update(mcpRequest, {
        transportType: 'stdio',
        url: 'npx mcp-client stdio',
        env: [
          {
            id: 'var1',
            name: 'foo',
            value: 'bar',
            type: EnvironmentKvPairDataType.STRING,
          },
          {
            id: 'var2',
            name: 'foo1',
            value: 'bar1',
            type: EnvironmentKvPairDataType.STRING,
          },
        ],
        roots: [
          {
            uri: 'file:///path/to/root',
          },
        ],
      });

      result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      parsed = YAML.parse(result);
      expect(parsed.type).toBe('mcpClient.insomnia/5.0');
      expect(parsed.mcpRequest.url).toBe('npx mcp-client stdio');
      expect(parsed.mcpRequest.transportType).toBe('stdio');
      expect(parsed.mcpRequest.env).toHaveLength(2);
      expect(parsed.mcpRequest.roots).toHaveLength(1);
    });

    it('exports mcp request with a stable key order', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_mcp_order',
        name: 'MCP Order Workspace',
        parentId: 'proj_test',
        scope: 'mcp',
      });

      await services.environment.create({
        _id: 'env_mcp_order',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      await services.mcpRequest.create({
        _id: 'mcp-request_order',
        name: 'Order MCP client',
        parentId: workspace._id,
        url: 'npx mcp-client stdio',
        transportType: 'stdio',
        headers: [{ name: 'X-MCP', value: '1' }],
        authentication: { type: 'basic', username: 'user', password: 'pass' },
        env: [{ id: 'var1', name: 'foo', value: 'bar', type: EnvironmentKvPairDataType.STRING, enabled: true }],
        roots: [{ uri: 'file:///workspace' }],
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const { mcpRequest } = YAML.parse(result);
      expect(Object.keys(mcpRequest)).toEqual([
        'name',
        'url',
        'transportType',
        'headers',
        'authentication',
        'meta',
        'env',
        'roots',
      ]);
      expect(Object.keys(mcpRequest.env[0])).toEqual(['id', 'name', 'value', 'type', 'enabled']);
      expect(Object.keys(mcpRequest.roots[0])).toEqual(['uri']);
    });

    it('exports collection items and cookie jar with a stable key order', async () => {
      const workspace = await services.workspace.create({
        _id: 'wrk_items_order',
        name: 'Items Order Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      await services.environment.create({
        _id: 'env_items_order',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      const auth = { type: 'basic', username: 'user', password: 'pass' } as const;
      const headers = [{ name: 'X-Order', value: '1', description: 'header', disabled: false }];
      const parameters = [
        { name: 'q', value: '1', description: 'param', disabled: false, type: 'text', multiline: false },
      ];
      const pathParameters = [{ name: 'id', value: '1' }];

      const folder = await services.requestGroup.create({
        _id: 'fld_order',
        name: 'folder-order',
        parentId: workspace._id,
        authentication: auth,
        environment: { foo: 'bar' },
        environmentPropertyOrder: { '&': ['foo'] },
        headers,
        preRequestScript: 'pre',
        afterResponseScript: 'after',
        metaSortKey: 1,
      });
      await services.request.create({
        _id: 'req_order',
        name: 'request-order',
        parentId: folder._id,
        url: 'https://example.com',
        method: 'POST',
        body: {
          mimeType: 'multipart/form-data',
          text: 'text',
          fileName: 'file.txt',
          params: [
            {
              name: 'p',
              value: 'v',
              description: 'body param',
              disabled: false,
              multiline: false,
              fileName: 'f.txt',
              type: 'file',
            },
          ],
        },
        parameters,
        headers,
        authentication: auth,
        preRequestScript: 'pre',
        afterResponseScript: 'after',
        pathParameters,
        metaSortKey: 2,
      });
      await services.grpcRequest.create({
        _id: 'greq_order',
        name: 'grpc-order',
        parentId: workspace._id,
        url: 'grpcb.in:9000',
        protoFileId: 'pf_order',
        protoMethodName: '/hello.HelloService/SayHello',
        body: { text: '{}' },
        metadata: [{ name: 'X-Order', value: '1' }],
        reflectionApi: { enabled: true, url: 'http://reflection', apiKey: 'key', module: 'module' },
        metaSortKey: 3,
      });
      await services.webSocketRequest.create({
        _id: 'ws-req_order',
        name: 'websocket-order',
        parentId: workspace._id,
        url: 'wss://example.com',
        authentication: auth,
        headers,
        parameters,
        pathParameters,
        metaSortKey: 4,
      });
      await services.socketIORequest.create({
        _id: 'socketio-req_order',
        name: 'socketio-order',
        parentId: workspace._id,
        url: 'https://example.com',
        settingPath: '/socket',
        authentication: auth,
        headers,
        parameters,
        pathParameters,
        eventListeners: [{ id: 'listener1', eventName: 'join', desc: 'on join', isOpen: true }],
        metaSortKey: 5,
      });
      await services.webSocketPayload.create({
        _id: 'ws-payload_order',
        parentId: 'ws-req_order',
        name: 'payload-order',
        value: '{"ping":1}',
        mode: 'application/json',
      });
      await services.socketIOPayload.create({
        _id: 'socket-io-payload_order',
        parentId: 'socketio-req_order',
        eventName: 'chat message',
        ack: true,
        args: [{ id: 'arg1', value: '"world"', mode: 'application/json' }],
      });

      const cookieJar = await services.cookieJar.getOrCreateForParentId(workspace._id);
      await services.cookieJar.update(cookieJar, {
        cookies: [
          {
            id: 'cookie1',
            key: 'k',
            value: 'v',
            expires: null,
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
          },
        ],
      });

      const result = await getInsomniaV5DataExport({
        workspaceId: workspace._id,
        includePrivateEnvironments: false,
      });

      const parsed = YAML.parse(result);
      const findItem = (name: string) => parsed.collection.find((item: { name: string }) => item.name === name);

      const exportedFolder = findItem('folder-order');
      expect(Object.keys(exportedFolder)).toEqual([
        'name',
        'meta',
        'children',
        'scripts',
        'authentication',
        'environment',
        'environmentPropertyOrder',
        'headers',
      ]);
      expect(Object.keys(exportedFolder.scripts)).toEqual(['preRequest', 'afterResponse']);

      const exportedRequest = exportedFolder.children[0];
      expect(Object.keys(exportedRequest)).toEqual([
        'url',
        'name',
        'meta',
        'method',
        'body',
        'parameters',
        'headers',
        'authentication',
        'scripts',
        'settings',
        'pathParameters',
      ]);
      expect(Object.keys(exportedRequest.body)).toEqual(['mimeType', 'text', 'fileName', 'params']);
      expect(Object.keys(exportedRequest.body.params[0])).toEqual([
        'name',
        'value',
        'description',
        'disabled',
        'multiline',
        'fileName',
        'type',
      ]);
      expect(Object.keys(exportedRequest.parameters[0])).toEqual([
        'name',
        'value',
        'description',
        'disabled',
        'type',
        'multiline',
      ]);
      expect(Object.keys(exportedRequest.settings)).toEqual([
        'renderRequestBody',
        'encodeUrl',
        'followRedirects',
        'cookies',
        'rebuildPath',
      ]);
      expect(Object.keys(exportedRequest.settings.cookies)).toEqual(['send', 'store']);

      const exportedGrpc = findItem('grpc-order');
      expect(Object.keys(exportedGrpc)).toEqual([
        'url',
        'name',
        'meta',
        'body',
        'metadata',
        'protoFileId',
        'protoMethodName',
        'reflectionApi',
      ]);
      expect(Object.keys(exportedGrpc.reflectionApi)).toEqual(['enabled', 'url', 'apiKey', 'module']);

      const exportedWebSocket = findItem('websocket-order');
      expect(Object.keys(exportedWebSocket)).toEqual([
        'url',
        'name',
        'meta',
        'settings',
        'authentication',
        'headers',
        'parameters',
        'pathParameters',
        'body',
      ]);
      expect(Object.keys(exportedWebSocket.settings)).toEqual(['encodeUrl', 'cookies', 'followRedirects']);
      expect(Object.keys(exportedWebSocket.settings.cookies)).toEqual(['store', 'send']);
      expect(Object.keys(exportedWebSocket.body)).toEqual(['meta', 'name', 'value', 'mode']);
      expect(Object.keys(exportedWebSocket.body.meta)).toEqual(['id', 'created', 'modified']);
      expect(exportedWebSocket.body.meta.id).toBe('ws-payload_order');

      const exportedSocketIO = findItem('socketio-order');
      expect(Object.keys(exportedSocketIO)).toEqual([
        'url',
        'name',
        'meta',
        'settings',
        'authentication',
        'headers',
        'parameters',
        'pathParameters',
        'eventListeners',
        'body',
      ]);
      expect(Object.keys(exportedSocketIO.settings)).toEqual(['encodeUrl', 'cookies', 'path']);
      expect(Object.keys(exportedSocketIO.settings.cookies)).toEqual(['store', 'send']);
      expect(Object.keys(exportedSocketIO.eventListeners[0])).toEqual(['id', 'eventName', 'desc', 'isOpen']);
      expect(Object.keys(exportedSocketIO.body)).toEqual(['meta', 'eventName', 'ack', 'args']);
      expect(Object.keys(exportedSocketIO.body.meta)).toEqual(['id', 'created', 'modified']);
      expect(exportedSocketIO.body.meta.id).toBe('socket-io-payload_order');
      expect(Object.keys(exportedSocketIO.body.args[0])).toEqual(['id', 'value', 'mode']);

      expect(Object.keys(parsed.cookieJar)).toEqual(['name', 'meta', 'cookies']);
      expect(Object.keys(parsed.cookieJar.cookies[0])).toEqual([
        'id',
        'key',
        'value',
        'domain',
        'path',
        'secure',
        'httpOnly',
      ]);
    });

    it('returns empty string for unknown workspace', async () => {
      const result = await getInsomniaV5DataExport({
        workspaceId: 'missing',
        includePrivateEnvironments: false,
      });
      expect(result).toBe('');
    });
  });

  describe('confidentialKeys', () => {
    const kvPair = (name: string, value: string, isConfidential: boolean, enabled = true) => ({
      id: `envPair_${name}_${value}`,
      name,
      value,
      type: EnvironmentKvPairDataType.STRING,
      enabled,
      isConfidential,
    });

    it('exports the names of confidential variables for environments and folders', async () => {
      const baseEnvironment = await services.environment.create({
        _id: 'env_base',
        name: 'Base Env',
        parentId: 'wrk_test',
        data: { token: 'secret', host: 'example.com', apiKey: 'key', renamed: 'public' },
        environmentType: EnvironmentType.KVPAIR,
        kvPairData: [
          kvPair('token', 'secret', true),
          kvPair('host', 'example.com', false),
          kvPair('apiKey', 'key', true),
          // only the last enabled row with a name takes effect
          kvPair('renamed', 'old', true),
          kvPair('renamed', 'public', false),
          kvPair('disabled', 'value', true, false),
        ],
      });
      await services.environment.create({
        _id: 'env_sub',
        name: 'Sub Env',
        parentId: baseEnvironment._id,
        data: { password: 'p@ss' },
        environmentType: EnvironmentType.KVPAIR,
        kvPairData: [kvPair('password', 'p@ss', true)],
      });
      await services.environment.create({
        _id: 'env_json',
        name: 'JSON Env',
        parentId: baseEnvironment._id,
        data: { stale: 'value' },
        // kvPairData is not the source of truth in the JSON view
        environmentType: EnvironmentType.JSON,
        kvPairData: [kvPair('stale', 'value', true)],
      });
      await services.requestGroup.create({
        _id: 'fld_confidential',
        name: 'Folder',
        parentId: 'wrk_test',
        environment: { folderToken: 'folder-secret' },
        environmentType: EnvironmentType.KVPAIR,
        kvPairData: [kvPair('folderToken', 'folder-secret', true)],
      });

      const exported = YAML.parse(
        await getInsomniaV5DataExport({ workspaceId: 'wrk_test', includePrivateEnvironments: false }),
      );

      expect(exported.environments.confidentialKeys).toEqual(['apiKey', 'token']);
      const subEnvironments = Object.fromEntries(exported.environments.subEnvironments.map((e: any) => [e.name, e]));
      expect(subEnvironments['Sub Env'].confidentialKeys).toEqual(['password']);
      expect(subEnvironments['JSON Env']).not.toHaveProperty('confidentialKeys');
      expect(exported.collection[0].confidentialKeys).toEqual(['folderToken']);
    });

    it('restores the table view and confidential flags from confidentialKeys', () => {
      const result = importInsomniaV5Data(`
type: collection.insomnia.rest/5.0
name: Test Collection
meta:
  id: wrk_test
collection:
  - name: Folder
    meta:
      id: fld_confidential
    environment:
      folderToken: folder-secret
    confidentialKeys:
      - folderToken
environments:
  name: Base Env
  meta:
    id: env_base
  data:
    token: secret
    host: example.com
  confidentialKeys:
    - token
  subEnvironments:
    - name: Sub Env
      meta:
        id: env_sub
      data:
        password: p@ss
      confidentialKeys:
        - password
    - name: Plain Env
      meta:
        id: env_plain
      data:
        foo: bar
`);
      const byId = Object.fromEntries(result.map(doc => [doc._id, doc as any]));
      const flags = (doc: any) =>
        Object.fromEntries(doc.kvPairData.map((pair: any) => [pair.name, pair.isConfidential]));

      expect(byId.env_base.environmentType).toBe(EnvironmentType.KVPAIR);
      expect(flags(byId.env_base)).toEqual({ token: true, host: false });
      expect(byId.env_sub.environmentType).toBe(EnvironmentType.KVPAIR);
      expect(flags(byId.env_sub)).toEqual({ password: true });
      expect(byId.fld_confidential.environmentType).toBe(EnvironmentType.KVPAIR);
      expect(flags(byId.fld_confidential)).toEqual({ folderToken: true });
      // files without confidentialKeys import exactly as before
      expect(byId.env_plain).not.toHaveProperty('environmentType');
      expect(byId.env_plain).not.toHaveProperty('kvPairData');
    });
  });

  describe('Edge Cases', () => {
    it('imports collection without meta', () => {
      const yaml = `
type: collection.insomnia.rest/5.0
name: No Meta Collection
collection: []
`;
      const result = tryImportV5Data(yaml);
      expect(result.data[0]._id).toBe('__WORKSPACE_ID__');
    });

    it('imports empty collection safely', () => {
      const yaml = `
type: collection.insomnia.rest/5.0
name: Empty
collection: []
`;
      const result = tryImportV5Data(yaml);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('handles invalid YAML', () => {
      const invalid = 'invalid: yaml: content: [unclosed array';
      const result = tryImportV5Data(invalid);
      expect(result.data).toEqual([]);
      expect(result.error).toBeDefined();
    });
  });

  describe('Handle legacy Insomnia files', () => {
    it('imports collection with incomplete header', () => {
      const yaml = `
type: collection.insomnia.rest/5.0
name: Test Collection
meta:
  id: wrk_legacy_insomnia_file
  created: 1234567890
  modified: 1234567890
collection:
  - name: Test Request
    url: https://api.example.com/test
    method: GET
    meta:
      id: req_test
      created: 1234567890
      modified: 1234567890
    headers:
      - name: missing_value_header
      - name: number
        value: "100"
      - name: offset
        value: "0"
`;
      const result = tryImportV5Data(yaml);
      expect(result.error).toBeUndefined();
      expect(result.data).toHaveLength(2);
      expect(result.data[0]._id).toBe('wrk_legacy_insomnia_file');
      expect(result.data[1].type).toBe('Request');
      const requestData = result.data[1] as Request;
      expect(requestData.headers).toHaveLength(3);
    });
  });
});
