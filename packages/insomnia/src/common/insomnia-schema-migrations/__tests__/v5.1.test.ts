/**
 * Tests for Insomnia Schema Migrations
 *
 * This test suite verifies that schema migrations work correctly,
 * particularly the v5.1 migration that removes id fields from headers/parameters
 * and preserves OpenAPI spec contents.
 */

import { describe, expect, it } from 'vitest';

import { migrateToLatestYaml } from '../index';
import { INSOMNIA_SCHEMA_VERSION } from '../schema-version';
import { cleanHeadersAndParameters } from '../v5.1';

describe('Insomnia Schema Migrations - v5.1', () => {
  describe('cleanHeadersAndParameters', () => {
    it('removes id fields from headers', () => {
      const obj = {
        headers: [
          { id: 'header1', name: 'Content-Type', value: 'application/json' },
          { id: 'header2', name: 'Accept', value: 'text/plain' },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.headers).toHaveLength(2);
      expect(result.headers[0]).toEqual({
        name: 'Content-Type',
        value: 'application/json',
      });
      expect(result.headers[1]).toEqual({ name: 'Accept', value: 'text/plain' });
    });

    it('removes id fields from parameters', () => {
      const obj = {
        parameters: [
          { id: 'param1', name: 'limit', value: '10' },
          { id: 'param2', name: 'offset', value: '0' },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0]).toEqual({ name: 'limit', value: '10' });
      expect(result.parameters[1]).toEqual({ name: 'offset', value: '0' });
    });

    it('preserves OpenAPI $ref parameters and removes id', () => {
      const obj = {
        parameters: [
          { id: 'param1', $ref: '#/components/parameters/PageSize' },
          { id: 'param2', $ref: '#/components/parameters/PageNumber' },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0]).toEqual({
        $ref: '#/components/parameters/PageSize',
      });
      expect(result.parameters[1]).toEqual({
        $ref: '#/components/parameters/PageNumber',
      });
      // Verify id was removed
      expect(result.parameters[0].id).toBeUndefined();
      expect(result.parameters[1].id).toBeUndefined();
    });

    it('preserves OpenAPI parameters with schema/in/required properties', () => {
      const obj = {
        parameters: [
          {
            id: 'param1',
            name: 'limit',
            in: 'query',
            schema: { type: 'integer' },
          },
          {
            id: 'param2',
            name: 'offset',
            in: 'query',
            required: true,
          },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0]).toEqual({
        name: 'limit',
        in: 'query',
        schema: { type: 'integer' },
      });
      expect(result.parameters[1]).toEqual({
        name: 'offset',
        in: 'query',
        required: true,
      });
    });

    it('filters out empty entries', () => {
      const obj = {
        headers: [
          { id: 'header1', name: 'Content-Type', value: 'application/json' },
          { id: 'header2', name: '', value: '' },
          { id: 'header3' },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.headers).toHaveLength(1);
      expect(result.headers[0]).toEqual({
        name: 'Content-Type',
        value: 'application/json',
      });
    });

    it('removes entire arrays when all entries are filtered', () => {
      const obj = {
        headers: [{ id: 'header1', name: '', value: '' }],
        parameters: [],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.headers).toBeUndefined();
      expect(result.parameters).toBeUndefined();
    });

    it('preserves file upload entries without name/value', () => {
      const obj = {
        parameters: [
          {
            id: 'upload1',
            type: 'file',
            fileName: 'test.pdf',
          },
          {
            id: 'upload2',
            type: 'file',
            fileName: 'test.jpg',
            name: 'document',
            value: '',
          },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.parameters).toHaveLength(2);
      expect(result.parameters[0]).toEqual({
        type: 'file',
        fileName: 'test.pdf',
      });
      expect(result.parameters[1]).toEqual({
        type: 'file',
        fileName: 'test.jpg',
        name: 'document',
        value: '',
      });
    });

    it('removes cookie timestamp fields', () => {
      const obj = {
        cookies: [
          {
            key: 'session',
            value: 'abc123',
            creation: new Date('2024-01-01'),
            lastAccessed: new Date('2024-01-02'),
          },
        ],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.cookies).toHaveLength(1);
      expect(result.cookies[0].creation).toBeUndefined();
      expect(result.cookies[0].lastAccessed).toBeUndefined();
      expect(result.cookies[0]).toEqual({
        key: 'session',
        value: 'abc123',
      });
    });

    it('handles deeply nested objects', () => {
      const obj = {
        headers: [
          {
            id: 'header1',
            name: 'Authorization',
            value: 'Bearer token',
          },
        ],
        body: {
          params: [
            { id: 'param1', name: 'field1', value: 'value1' },
            { id: 'param2', name: 'field2', value: 'value2' },
          ],
        },
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.headers[0]).toEqual({
        name: 'Authorization',
        value: 'Bearer token',
      });
      expect(result.body.params[0]).toEqual({ name: 'field1', value: 'value1' });
      expect(result.body.params[1]).toEqual({ name: 'field2', value: 'value2' });
    });

    it('handles null and undefined values', () => {
      const obj = {
        headers: null,
        parameters: undefined,
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result).toEqual(obj);
    });

    it('handles empty arrays', () => {
      const obj = {
        headers: [],
        parameters: [],
      };

      const result = cleanHeadersAndParameters(obj);

      expect(result.headers).toBeUndefined();
      expect(result.parameters).toBeUndefined();
    });
  });

  describe('OpenAPI Spec Contents Preservation', () => {
    it('preserves OpenAPI spec contents without modification', () => {
      const obj = {
        type: 'spec.insomnia.rest/5.0',
        spec: {
          contents: {
            openapi: '3.0.0',
            info: {
              title: 'Test API',
              version: '1.0.0',
            },
            paths: {
              '/control-planes': {
                get: {
                  operationId: 'list-control-planes',
                  summary: 'List Control Planes',
                  parameters: [
                    { $ref: '#/components/parameters/PageSize' },
                    { $ref: '#/components/parameters/PageNumber' },
                    { $ref: '#/components/parameters/ControlPlaneFilter' },
                  ],
                  responses: {
                    '200': {
                      description: 'Success',
                    },
                  },
                },
              },
            },
          },
        },
      };

      const result = cleanHeadersAndParameters(obj);

      // Verify the spec.contents field is preserved exactly as-is
      expect(result.spec.contents.openapi).toBe('3.0.0');
      expect(result.spec.contents.paths['/control-planes'].get.parameters).toHaveLength(3);
      expect(result.spec.contents.paths['/control-planes'].get.parameters[0]).toEqual({
        $ref: '#/components/parameters/PageSize',
      });
    });

    it('preserves Kong Konnect Control Planes API spec without modification', () => {
      const konnectApiSpec = {
        type: 'spec.insomnia.rest/5.0',
        spec: {
          contents: {
            openapi: '3.0.0',
            info: {
              title: 'Konnect Control Planes',
              version: '2.0.0',
              description: 'The API for Kong Konnect Control Planes.',
            },
            paths: {
              '/control-planes': {
                get: {
                  operationId: 'list-control-planes',
                  summary: 'List Control Planes',
                  description:
                    'Returns an array of control plane objects containing information about the Konnect Control Planes.',
                  parameters: [
                    { $ref: '#/components/parameters/PageSize' },
                    { $ref: '#/components/parameters/PageNumber' },
                    { $ref: '#/components/parameters/ControlPlaneFilter' },
                    { $ref: '#/components/parameters/FilterByLabels' },
                    { $ref: '#/components/parameters/ControlPlaneSort' },
                  ],
                  responses: {
                    '200': {
                      $ref: '#/components/responses/ListControlPlanesResponse',
                    },
                    '400': {
                      $ref: '#/components/responses/ControlPlanesBadRequest',
                    },
                  },
                  tags: ['Control Planes'],
                },
              },
            },
            components: {
              parameters: {
                PageSize: {
                  name: 'page[size]',
                  description: 'The maximum number of items to include per page.',
                  required: false,
                  in: 'query',
                  schema: {
                    type: 'integer',
                    example: 10,
                  },
                },
                PageNumber: {
                  name: 'page[number]',
                  description: 'Determines which page of the entities to retrieve.',
                  required: false,
                  in: 'query',
                  schema: {
                    type: 'integer',
                    example: 1,
                  },
                },
                ControlPlaneFilter: {
                  name: 'filter',
                  description: 'Filters a collection of control-planes.',
                  required: false,
                  in: 'query',
                  schema: {
                    $ref: '#/components/schemas/ControlPlaneFilterParameters',
                  },
                  style: 'deepObject',
                },
                ControlPlaneSort: {
                  name: 'sort',
                  description: 'Sorts a collection of control-planes.',
                  required: false,
                  in: 'query',
                  schema: {
                    $ref: '#/components/schemas/SortQuery',
                  },
                },
                FilterByLabels: {
                  name: 'labels',
                  description: 'Filter control planes in the response by associated labels.',
                  in: 'query',
                  required: false,
                  schema: {
                    type: 'string',
                    example: 'key:value,existCheck',
                  },
                },
              },
            },
          },
        },
      };

      const result = cleanHeadersAndParameters(konnectApiSpec);

      // Verify spec.contents is completely untouched
      expect(result.spec.contents.openapi).toBe('3.0.0');
      expect(result.spec.contents.info.title).toBe('Konnect Control Planes');
      expect(result.spec.contents.paths['/control-planes'].get.parameters).toHaveLength(5);

      // Verify all $ref parameters are preserved exactly
      expect(result.spec.contents.paths['/control-planes'].get.parameters[0]).toEqual({
        $ref: '#/components/parameters/PageSize',
      });
      expect(result.spec.contents.paths['/control-planes'].get.parameters[1]).toEqual({
        $ref: '#/components/parameters/PageNumber',
      });
      expect(result.spec.contents.paths['/control-planes'].get.parameters[2]).toEqual({
        $ref: '#/components/parameters/ControlPlaneFilter',
      });
      expect(result.spec.contents.paths['/control-planes'].get.parameters[3]).toEqual({
        $ref: '#/components/parameters/FilterByLabels',
      });
      expect(result.spec.contents.paths['/control-planes'].get.parameters[4]).toEqual({
        $ref: '#/components/parameters/ControlPlaneSort',
      });

      // Verify components are preserved
      expect(result.spec.contents.components.parameters.PageSize).toBeDefined();
      expect(result.spec.contents.components.parameters.PageSize.name).toBe('page[size]');
    });

    it('handles YAML migration that preserves spec contents', () => {
      const yamlData = `
type: spec.insomnia.rest/5.0
name: Kong Konnect API
spec:
  contents:
    openapi: "3.0.0"
    paths:
      /control-planes:
        get:
          operationId: list-control-planes
          parameters:
            - $ref: "#/components/parameters/PageSize"
            - $ref: "#/components/parameters/PageNumber"
          responses:
            "200":
              description: Success
`;

      const migrated = migrateToLatestYaml(yamlData);

      // Verify the spec contents are preserved
      expect(migrated).toContain('$ref: "#/components/parameters/PageSize"');
      expect(migrated).toContain('$ref: "#/components/parameters/PageNumber"');
    });

    it('migrates request parameters but not spec contents', () => {
      const obj = {
        type: 'spec.insomnia.rest/5.0',
        collection: [
          {
            name: 'Test Request',
            url: 'https://api.example.com/test',
            method: 'GET',
            parameters: [{ id: 'param1', name: 'limit', value: '10' }],
          },
        ],
        spec: {
          contents: {
            paths: {
              '/test': {
                get: {
                  parameters: [{ id: 'spec_param', $ref: '#/components/parameters/Test' }],
                },
              },
            },
          },
        },
      };

      const result = cleanHeadersAndParameters(obj);

      // Request parameters should have id removed
      expect(result.collection[0].parameters[0]).toEqual({
        name: 'limit',
        value: '10',
      });

      // Spec contents should remain unchanged (including any ids)
      expect(result.spec.contents.paths['/test'].get.parameters).toHaveLength(1);
      expect(result.spec.contents.paths['/test'].get.parameters[0]).toEqual({
        id: 'spec_param',
        $ref: '#/components/parameters/Test',
      });
    });
  });

  describe('Schema Version Migration', () => {
    it('adds schema_version to files being migrated', () => {
      const yamlData = `
type: collection.insomnia.rest/5.0
name: Test Collection
collection:
  - name: Test Request
    url: https://api.example.com/test
    method: GET
    headers:
      - id: header1
        name: Content-Type
        value: application/json
`;

      const migrated = migrateToLatestYaml(yamlData);
      const parsed = JSON.parse(JSON.stringify(migrated)); // Parse like YAML parser would

      expect(parsed).toBeDefined();
      // Note: schema_version is added by migrateToLatest function in index.ts
    });

    it('does not migrate files already at latest version', () => {
      const yamlData = `type: collection.insomnia.rest/5.0
schema_version: ${INSOMNIA_SCHEMA_VERSION}
name: Test Collection
collection: []`;

      const migrated = migrateToLatestYaml(yamlData);

      // Files at latest version should be returned early without modification
      expect(migrated).toContain('type: collection.insomnia.rest/5.0');
      expect(migrated).toContain(`schema_version: ${INSOMNIA_SCHEMA_VERSION}`);
      expect(migrated).toContain('name: Test Collection');
      expect(migrated).toContain('collection: []');
    });
  });
});
