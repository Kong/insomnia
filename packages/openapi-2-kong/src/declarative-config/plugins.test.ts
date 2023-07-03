import { describe, expect, it } from '@jest/globals';
import { OpenAPIV3 } from 'openapi-types';

import { ParameterSchema, RequestTerminationPlugin, RequestValidatorPlugin, xKongPluginKeyAuth, xKongPluginRequestTermination, xKongPluginRequestValidator } from '../types/kong';
import { OA3Operation, OA3Parameter } from '../types/openapi3';
import { getSpec, pluginDummy, tags } from './jest/test-helpers';
import { ALLOW_ALL_SCHEMA, generateBodyOptions, generateGlobalPlugins, generateRequestValidatorPlugin } from './plugins';
describe('plugins', () => {
  describe('generateGlobalPlugins()', () => {
    it('generates plugin given a spec with a plugin attached', async () => {
      const api = getSpec({
        [xKongPluginRequestValidator]: {
          name: 'request-validator',
          enabled: false,
          config: {
            body_schema: ALLOW_ALL_SCHEMA,
            verbose_response: true,
          },
        },
        ...pluginDummy,
        [xKongPluginKeyAuth]: {
          name: 'key-auth',
          config: {
            key_names: ['x-api-key'],
          },
        },
      });

      const result = generateGlobalPlugins(api, tags);

      expect(result.plugins).toEqual([
        {
          name: 'dummy',
          tags,
          config: {
            foo: 'bar',
          },
        },
        {
          name: 'key-auth',
          tags,
          config: {
            key_names: ['x-api-key'],
          },
        },
        {
          config: {
            body_schema: ALLOW_ALL_SCHEMA,
            verbose_response: true,
            version: 'draft4',
          },
          tags,
          enabled: false,
          name: 'request-validator',
        },
      ]);
      expect(result.requestValidatorPlugin).toEqual({
        name: 'request-validator',
        config: {
          body_schema: ALLOW_ALL_SCHEMA,
          verbose_response: true,
        },
        enabled: false,
      });
    });

    it('does not add extra things to the plugin', async () => {
      const spec = getSpec({
        [xKongPluginRequestTermination]: {
          name: 'request-termination',
          mad: 'max',
          config: {
            // @ts-expect-error this is intentionally passing in an extra property
            max: 'is mad',
            status_code: 403,
            message: 'So long and thanks for all the fish!',
          },
        },
      });

      const result = generateGlobalPlugins(spec, tags);

      expect(result.plugins as RequestTerminationPlugin[]).toEqual([
        {
          name: 'request-termination',
          mad: 'max',
          tags,
          config: {
            max: 'is mad',
            status_code: 403,
            message: 'So long and thanks for all the fish!',
          },
        },
      ]);
    });
  });

  describe('generateRequestValidatorPlugin()', () => {
    const parameterSchema: ParameterSchema = {
      explode: false,
      in: 'path',
      name: 'human_timestamp',
      required: true,
      schema: '{"anyOf":[{"type":"string"}]}',
      style: 'form',
    };

    it('should retain config properties', async () => {
      const plugin: RequestValidatorPlugin = {
        name: 'request-validator',
        enabled: true,
        config: {
          parameter_schema: [parameterSchema],
          body_schema: '[{"name":{"type": "string", "required": true}}]',
          verbose_response: true,
          allowed_content_types: ['application/json'],
        },
      };
      const generated = generateRequestValidatorPlugin({ plugin, tags });
      expect(generated).toStrictEqual({
        name: 'request-validator',
        enabled: plugin.enabled,
        tags,
        config: {
          body_schema: ALLOW_ALL_SCHEMA,
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    it('should not add config properties if they are not defined', async () => {
      const plugin: RequestValidatorPlugin = {
        name: 'request-validator',
        enabled: true,
        config: {
          parameter_schema: [parameterSchema],
          body_schema: '[{"name":{"type": "string", "required": true}}]',
          // The following properties are missing
          // verbose_response: true,
          // allowed_content_types: ['application/json'],
        },
      };
      const generated = generateRequestValidatorPlugin({ plugin, tags });
      expect(generated).toStrictEqual({
        name: 'request-validator',
        enabled: plugin.enabled,
        tags,
        config: {
          body_schema: ALLOW_ALL_SCHEMA,
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    describe('parameter_schema', () => {
      it('should not add parameter_schema if no parameters present', async () => {
        const plugin: RequestValidatorPlugin = {
          name: 'request-validator',
          config: {
            body_schema: ALLOW_ALL_SCHEMA,
          },
        };

        const generated1 = generateRequestValidatorPlugin({ plugin, tags });
        expect(generated1.config).toStrictEqual({
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
        });

        const generated2 = generateRequestValidatorPlugin({
          plugin,
          operation: {
            parameters: [],
          },
          tags,
        });
        expect(generated2.config).toStrictEqual({
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
        });
      });

      it('should convert operation parameters to parameter_schema', async () => {
        const param: OA3Parameter = {
          in: 'query',
          explode: true,
          required: false,
          name: 'some_name',
          schema: {
            anyOf: [
              {
                type: 'string',
              },
            ],
          },
          style: 'form',
        };
        const operation: OA3Operation = {
          parameters: [param],
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          parameter_schema: [
            {
              in: param.in,
              name: param.name,
              required: Boolean(param.required),
              style: param.style,
              explode: param.explode,
              schema: '{"anyOf":[{"type":"string"}]}',
            },
          ],
        });
      });

      it('should return default if operation parameter schema not defined on any parameters', async () => {
        const operation: OA3Operation = {
          parameters: [
            {
              in: 'query',
              name: 'some_name',
            },
          ],
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          parameter_schema: [
            {
              explode: false,
              in: 'query',
              name: 'some_name',
              required: false,
              schema: '{}',
              style: 'form',
            },
          ],
        });
      });

      it('should ignore parameters without schema', async () => {
        const paramWithSchema: OA3Parameter = {
          in: 'query',
          explode: true,
          required: false,
          name: 'some_name',
          schema: {
            anyOf: [
              {
                type: 'string',
              },
            ],
          },
          style: 'form',
        };
        const paramWithoutSchema: OA3Parameter = {
          in: 'query',
          name: 'some_name',
        };
        const operation: OA3Operation = {
          parameters: [
            paramWithSchema,
            paramWithoutSchema,
          ],
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          parameter_schema: [
            {
              schema: '{"anyOf":[{"type":"string"}]}',
              in: paramWithSchema.in,
              name: paramWithSchema.name,
              style: paramWithSchema.style,
              explode: paramWithSchema.explode,
              required: Boolean(paramWithSchema.required),
            },
            {
              schema: '{}',
              in: paramWithoutSchema.in,
              name: paramWithoutSchema.name,
              style: 'form',
              explode: false,
              required: false,
            },
          ],
        });
      });
    });

    describe('body_schema and allowed_content_types', () => {
      it('should not add body_schema or allowed_content_types if no body present', async () => {
        const plugin: RequestValidatorPlugin = {
          name: 'request-validator',
          config: {
            body_schema: ALLOW_ALL_SCHEMA,
          },
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
        });
      });

      it('should return default if no operation request body content defined', async () => {
        const defaultReqVal: RequestValidatorPlugin['config'] = {
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
        };
        const op1: OpenAPIV3.OperationObject = {};
        const op2: OpenAPIV3.OperationObject = {
          requestBody: {
            $ref: '#/components/non-existent',
          },
        };
        expect((generateRequestValidatorPlugin({ operation: op1, tags })).config).toStrictEqual(
          defaultReqVal,
        );
        expect((generateRequestValidatorPlugin({ operation: op2, tags })).config).toStrictEqual(
          defaultReqVal,
        );
        expect((generateRequestValidatorPlugin({ tags })).config).toStrictEqual(
          defaultReqVal,
        );
      });

      it('should add non-json media types to allowed content types and not add body schema', async () => {
        const operation: OA3Operation = {
          requestBody: {
            content: {
              'application/xml': {},
              'text/yaml': {},
            },
          },
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
          allowed_content_types: ['application/xml', 'text/yaml'],
        });
      });

      it('should add body_schema and allowed content types', async () => {
        const schemaXml = {
          type: 'Object',
          properties: {
            name: {
              type: 'integer',
              format: 'int64',
            },
          },
        };
        const schemaJson = {
          type: 'Object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64',
            },
          },
        };
        const operation: OpenAPIV3.OperationObject = {
          requestBody: {
            content: {
              'application/xml': {
                schema: schemaXml,
              } as OpenAPIV3.SchemaObject,
              'application/json': {
                schema: schemaJson,
              } as OpenAPIV3.SchemaObject,
            },
          },
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: JSON.stringify(schemaJson),
          allowed_content_types: ['application/xml', 'application/json'],
        });
      });

      it('should default body_schema if no schema is defined or generated', async () => {
        const generated = generateRequestValidatorPlugin({ tags, operation: {} });
        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: ALLOW_ALL_SCHEMA,
        });
      });
    });
    describe('body_schema generateBodyOptions FTI-3278', () => {
      it('should keep to properties[].type unchanged nullable is not set', async () => {
        const generated = generateBodyOptions({
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    redirectUri: {
                      type: 'string',
                    },
                  },
                },
              },
            },
          },
        });
        expect(generated.bodySchema).toStrictEqual('{\"properties\":{\"redirectUri\":{\"type\":\"string\"}}}');
      });
      it('should keep to properties[].type unchanged nullable is false', async () => {
        const generated = generateBodyOptions({
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    redirectUri: {
                      type: 'string',
                      nullable: false,
                    },
                  },
                },
              },
            },
          },
        });
        expect(generated.bodySchema).toStrictEqual('{\"properties\":{\"redirectUri\":{\"type\":\"string\",\"nullable\":false}}}');
      });
      it('should append null to properties[].type if nullable is true', async () => {
        const generated = generateBodyOptions({
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  properties: {
                    redirectUri: {
                      type: 'string',
                      nullable: true,
                    },
                  },
                },
              },
            },
          },
        });
        expect(generated.bodySchema).toStrictEqual('{\"properties\":{\"redirectUri\":{\"type\":[\"string\",\"null\"],\"nullable\":true}}}');
      });
    });
  });
});
