/**
 * Comprehensive tests for Insomnia v5 import/export functionality
 *
 * This test suite covers all the functions we added comments to in insomnia-v5.ts,
 * ensuring they work correctly and handle edge cases properly.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import type { Request } from '~/insomnia-data';
import { EnvironmentKvPairDataType, services } from '~/insomnia-data';

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
      expect(insomniaSchemaTypeToScope('spec.insomnia.rest/5.0')).toBe('design');
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

    it('returns empty string for unknown workspace', async () => {
      const result = await getInsomniaV5DataExport({
        workspaceId: 'missing',
        includePrivateEnvironments: false,
      });
      expect(result).toBe('');
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
