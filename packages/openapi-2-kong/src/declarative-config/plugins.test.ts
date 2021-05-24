import { generateGlobalPlugins, generateRequestValidatorPlugin } from './plugins';
import { OA3Operation, OA3Parameter, xKongPluginKeyAuth, xKongPluginRequestTermination, xKongPluginRequestValidator } from '../types/openapi3';
import { DCPlugin, DCPluginConfig } from '../types/declarative-config';
import { getSpec } from './utils';

const tags = ['Tag'];

describe('plugins', () => {
  describe('generateGlobalPlugins()', () => {
    it('generates plugin given a spec with a plugin attached', async () => {
      const api = getSpec({
        [xKongPluginRequestValidator]: {
          enabled: false,
          config: {
            verbose_response: true,
          },
        },
        // @ts-expect-error -- TSCONVERSION needs work for generic for XKongPluginUnknown
        'x-kong-plugin-abcd': {
          config: {
            some_config: ['something'],
          },
        },
        [xKongPluginKeyAuth]: {
          name: 'key-auth',
          config: {
            key_names: ['x-api-key'],
          },
        },
      });

      const result = generateGlobalPlugins(api, tags);

      expect(result.plugins).toEqual<DCPlugin[]>([
        {
          name: 'abcd',
          tags,
          config: {
            some_config: ['something'],
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
            body_schema: '{}',
            verbose_response: true,
            version: 'draft4',
          },
          tags,
          enabled: false,
          name: 'request-validator',
        },
      ]);
      expect(result.requestValidatorPlugin).toEqual({
        config: {
          verbose_response: true,
        },
        enabled: false,
      });
    });

    it('does not add extra things to the plugin', () => {
      const spec = getSpec({
        [xKongPluginRequestTermination]: {
          name: 'request-termination',
          mad: 'max',
          config: {
            max: 'is mad',
            status_code: 403,
            message: 'So long and thanks for all the fish!',
          },
        },
      });

      const result = generateGlobalPlugins(spec, tags);

      expect(result.plugins).toBe([
        {
          name: 'request-termination',
          mad: 'max',
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
    const parameterSchema = [
      {
        schema: '{"anyOf":[{"type":"string"}]}',
        style: 'form',
        in: 'path',
        name: 'human_timestamp',
        required: true,
        explode: false,
      },
    ];

    it('should retain config properties', () => {
      const plugin = {
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
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    it('should not add config properties if they are not defined', () => {
      const plugin = {
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
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    describe('parameter_schema', () => {
      it('should not add parameter_schema if no parameters present', () => {
        const plugin = {
          enabled: true,
          config: {},
        };
        const generated1 = generateRequestValidatorPlugin({ plugin, tags });
        const generated2 = generateRequestValidatorPlugin({
          plugin,
          operation: {
            parameters: [],
          },
          tags,
        });
        expect(generated1.config).toStrictEqual({
          version: 'draft4',
          body_schema: '{}',
        });
        expect(generated2.config).toStrictEqual({
          version: 'draft4',
          body_schema: '{}',
        });
      });

      it('should convert operation parameters to parameter_schema', () => {
        const plugin = {
          config: {},
        };
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
        const generated = generateRequestValidatorPlugin({ plugin, tags, operation });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          parameter_schema: [
            {
              schema: '{"anyOf":[{"type":"string"}]}',
              style: param.style,
              in: param.in,
              name: param.name,
              explode: param.explode,
              required: param.required,
            },
          ],
        });
      });

      it('should return default if operation parameter schema not defined on any parameters', () => {
        const plugin = {};
        const operation: OA3Operation = {
          parameters: [
            {
              in: 'query',
              name: 'some_name',
            },
          ],
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags, operation });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
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

      it('should ignore parameters without schema', () => {
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
        const generated = generateRequestValidatorPlugin({ plugin: {}, tags, operation });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          parameter_schema: [
            {
              schema: '{"anyOf":[{"type":"string"}]}',
              style: paramWithSchema.style,
              in: paramWithSchema.in,
              name: paramWithSchema.name,
              explode: paramWithSchema.explode,
              required: paramWithSchema.required,
            },
            {
              schema: '{}',
              style: 'form',
              in: paramWithoutSchema.in,
              name: paramWithoutSchema.name,
              explode: false,
              required: false,
            },
          ],
        });
      });
    });

    describe('body_schema and allowed_content_types', () => {
      it('should not add body_schema or allowed_content_types if no body present', () => {
        const plugin = {
          config: {},
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          body_schema: '{}',
        });
      });

      it('should return default if no operation request body content defined', () => {
        const plugin = {};
        const defaultReqVal = {
          version: 'draft4',
          body_schema: '{}',
        };
        const op1: OA3Operation = {
          requestBody: {},
        };
        const op2: OA3Operation = {
          requestBody: {
            $ref: 'non-existent',
          },
        };
        expect(generateRequestValidatorPlugin({ plugin, operation: op1, tags }).config).toStrictEqual(
          defaultReqVal,
        );
        expect(generateRequestValidatorPlugin({ plugin, operation: op2, tags }).config).toStrictEqual(
          defaultReqVal,
        );
        expect(generateRequestValidatorPlugin({ plugin, tags }).config).toStrictEqual(
          defaultReqVal,
        );
      });

      it('should add non-json media types to allowed content types and not add body schema', () => {
        const plugin = {};
        const operation: OA3Operation = {
          requestBody: {
            content: {
              'application/xml': {},
              'text/yaml': {},
            },
          },
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags, operation });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          body_schema: '{}',
          allowed_content_types: ['application/xml', 'text/yaml'],
        });
      });

      it('should add body_schema and allowed content types', () => {
        const plugin = {};
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
        const operation: OA3Operation = {
          requestBody: {
            content: {
              'application/xml': {
                schema: schemaXml,
              },
              'application/json': {
                schema: schemaJson,
              },
            },
          },
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags, operation });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          body_schema: JSON.stringify(schemaJson),
          allowed_content_types: ['application/xml', 'application/json'],
        });
      });

      it('should default body_schema if no schema is defined or generated', () => {
        const generated = generateRequestValidatorPlugin({ plugin: {}, tags, operation: {} });
        expect(generated.config).toStrictEqual<DCPluginConfig>({
          version: 'draft4',
          body_schema: '{}',
        });
      });
    });
  });
});
