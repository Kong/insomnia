import { generateGlobalPlugins, generateRequestValidatorPlugin } from './plugins';
import { OA3Operation, OA3Parameter } from '../types/openapi3';
import { DCPlugin } from '../types/declarative-config';
import { getSpec } from './utils';
import { ParameterSchema, RequestTerminationPlugin, RequestValidatorPlugin, xKongPluginKeyAuth, xKongPluginRequestTermination, xKongPluginRequestValidator } from '../types/kong';

const tags = ['Tag'];

describe('plugins', () => {
  describe('generateGlobalPlugins()', () => {
    it('generates plugin given a spec with a plugin attached', async () => {
      const api = getSpec({
        [xKongPluginRequestValidator]: {
          name: 'request-validator',
          enabled: false,
          config: {
            body_schema: '{}',
            verbose_response: true,
          },
        },
        // @ts-expect-error -- TSCONVERSION needs work for generic for XKongPluginUnknown
        'x-kong-plugin-abcd': {
          name: 'abcd',
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
          // @ts-expect-error -- TSCONVERSION needs work for generic for XKongPluginUnknown
          name: 'abcd',
          tags,
          config: {
            // @ts-expect-error -- TSCONVERSION needs work for generic for XKongPluginUnknown
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
        name: 'request-validator',
        config: {
          body_schema: '{}',
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
            // @ts-expect-error this is intentionally passing in an extra property
            max: 'is mad',
            status_code: 403,
            message: 'So long and thanks for all the fish!',
          },
        },
      });

      const result = generateGlobalPlugins(spec, tags);

      expect(result.plugins).toEqual<RequestTerminationPlugin[]>([
        {
          name: 'request-termination',
          mad: 'max',
          tags,
          config: {
            // @ts-expect-error this is intentionally passing in an extra property
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

    it('should retain config properties', () => {
      const plugin: RequestValidatorPlugin = {
        name: 'request-validator',
        enabled: true,
        config: {
          parameter_schema: [parameterSchema],
          body_schema: '[{"name":{"type": "string", "required": true}}]',
          verbose_response: true,
          // @ts-expect-error TODO
          allowed_content_types: ['application/json'],
        },
      };
      const generated = generateRequestValidatorPlugin({ plugin, tags });
      expect(generated).toStrictEqual<RequestValidatorPlugin>({
        name: 'request-validator',
        enabled: plugin.enabled,
        tags,
        config: {
          body_schema: '{}',
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    it('should not add config properties if they are not defined', () => {
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
      expect(generated).toStrictEqual<RequestValidatorPlugin>({
        name: 'request-validator',
        enabled: plugin.enabled,
        tags,
        config: {
          body_schema: '{}',
          version: 'draft4',
          ...plugin.config,
        },
      });
    });

    describe('parameter_schema', () => {
      it('should not add parameter_schema if no parameters present', () => {
        const plugin: RequestValidatorPlugin = {
          name: 'request-validator',
          enabled: true,
          config: {
            body_schema: '{}',
          },
        };

        const generated1 = generateRequestValidatorPlugin({ plugin, tags });
        expect(generated1.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: '{}',
        });

        const generated2 = generateRequestValidatorPlugin({
          plugin,
          operation: {
            parameters: [],
          },
          tags,
        });
        expect(generated2.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: '{}',
        });
      });

      it('should convert operation parameters to parameter_schema', () => {
        const plugin: RequestValidatorPlugin = {
          name: 'request-validator',
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
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          parameter_schema: [
            {
              schema: '{"anyOf":[{"type":"string"}]}',
              in: param.in,
              name: param.name,
              // @ts-expect-error TODO
              style: param.style,
              // @ts-expect-error TODO
              explode: param.explode,
              // @ts-expect-error TODO
              required: param.required,
            },
          ],
        });
      });

      it('should return default if operation parameter schema not defined on any parameters', () => {
        const operation: OA3Operation = {
          parameters: [
            {
              in: 'query',
              name: 'some_name',
            },
          ],
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
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
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          parameter_schema: [
            {
              schema: '{"anyOf":[{"type":"string"}]}',
              in: paramWithSchema.in,
              name: paramWithSchema.name,
              // @ts-expect-error TODO
              style: paramWithSchema.style,
              // @ts-expect-error TODO
              explode: paramWithSchema.explode,
              // @ts-expect-error TODO
              required: paramWithSchema.required,
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
      it('should not add body_schema or allowed_content_types if no body present', () => {
        const plugin: RequestValidatorPlugin = {
          name: 'request-validator',
          config: {
            body_schema: '{}',
          },
        };
        const generated = generateRequestValidatorPlugin({ plugin, tags });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: '{}',
        });
      });

      it('should return default if no operation request body content defined', () => {
        const defaultReqVal: RequestValidatorPlugin['config'] = {
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
        expect(generateRequestValidatorPlugin({ operation: op1, tags }).config).toStrictEqual(
          defaultReqVal,
        );
        expect(generateRequestValidatorPlugin({ operation: op2, tags }).config).toStrictEqual(
          defaultReqVal,
        );
        expect(generateRequestValidatorPlugin({ tags }).config).toStrictEqual(
          defaultReqVal,
        );
      });

      it('should add non-json media types to allowed content types and not add body schema', () => {
        const operation: OA3Operation = {
          requestBody: {
            content: {
              'application/xml': {},
              'text/yaml': {},
            },
          },
        };
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: '{}',
          // @ts-expect-error TODO
          allowed_content_types: ['application/xml', 'text/yaml'],
        });
      });

      it('should add body_schema and allowed content types', () => {
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
        const generated = generateRequestValidatorPlugin({ tags, operation });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: JSON.stringify(schemaJson),
          // @ts-expect-error TODO
          allowed_content_types: ['application/xml', 'application/json'],
        });
      });

      it('should default body_schema if no schema is defined or generated', () => {
        const generated = generateRequestValidatorPlugin({ tags, operation: {} });
        expect(generated.config).toStrictEqual<RequestValidatorPlugin['config']>({
          version: 'draft4',
          body_schema: '{}',
        });
      });
    });
  });
});
