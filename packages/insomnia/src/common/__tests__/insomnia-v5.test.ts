/**
 * Comprehensive tests for Insomnia v5 import/export functionality
 *
 * This test suite covers all the functions we added comments to in insomnia-v5.ts,
 * ensuring they work correctly and handle edge cases properly.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { INSOMNIA_SCHEMA_VERSION } from '../../common/insomnia-schema-migrations/schema-version';
import * as models from '../../models';
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
    await models.project.create({
      _id: 'proj_test',
      name: 'Test Project',
    });

    await models.workspace.create({
      _id: 'wrk_test',
      name: 'Test Workspace',
      parentId: 'proj_test',
      scope: 'collection',
    });

    await models.settings.getOrCreate();
  });

  describe('insomniaSchemaTypeToScope', () => {
    it('maps v5 schema types to workspace scopes', () => {
      expect(insomniaSchemaTypeToScope('collection.insomnia.rest/5.0')).toBe('collection');
      expect(insomniaSchemaTypeToScope('environment.insomnia.rest/5.0')).toBe('environment');
      expect(insomniaSchemaTypeToScope('spec.insomnia.rest/5.0')).toBe('design');
      expect(insomniaSchemaTypeToScope('mock.insomnia.rest/5.0')).toBe('mock-server');
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
      const workspace = await models.workspace.create({
        _id: 'wrk_export_test',
        name: 'Export Test Workspace',
        parentId: 'proj_test',
        created: 1_234_567_890,
        modified: 1_234_567_890,
        description: 'Test workspace for export',
        scope: 'collection',
      });

      await models.request.create({
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
      await models.environment.create({
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
      const workspace = await models.workspace.create({
        _id: 'wrk_empty_test',
        name: 'Empty Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      // must add a base environment
      await models.environment.create({
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
      const workspace = await models.workspace.create({
        _id: 'wrk_filter_test',
        name: 'Filter Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      await models.environment.create({
        _id: 'env_filter',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      const req1 = await models.request.create({
        _id: 'req_filter_1',
        name: 'Request 1',
        parentId: workspace._id,
        url: 'https://api.example.com/1',
        method: 'GET',
      });

      await models.request.create({
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
      const workspace = await models.workspace.create({
        _id: 'wrk_design_test',
        name: 'Design Workspace',
        parentId: 'proj_test',
        scope: 'design',
      });

      await models.environment.create({
        _id: 'env_design',
        name: 'Base Env',
        parentId: workspace._id,
        data: {},
      });

      await models.apiSpec.getOrCreateForParentId(workspace._id, {
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
      const workspace = await models.workspace.create({
        _id: 'wrk_mock',
        name: 'Mock Workspace',
        parentId: 'proj_test',
        scope: 'mock-server',
      });

      await models.mockServer.create({
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
});
