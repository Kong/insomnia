// @flow

import { generateGlobalPlugins, generateRequestValidatorPlugin } from '../plugins';

describe('plugins', () => {
  describe('generateGlobalPlugins()', () => {
    it('generates plugin given a spec with a plugin attached', async () => {
      const api: OpenApi3Spec = {
        openapi: '3.0.2',
        info: {
          title: 'something',
          version: '12',
        },
        paths: {},
        'x-kong-plugin-request-validator': {
          enabled: false,
          config: { verbose_response: true },
        },
        'x-kong-plugin-abcd': {
          config: {
            some_config: ['something'],
          },
        },
        'x-kong-plugin-key-auth': {
          name: 'key-auth',
          config: {
            key_names: ['x-api-key'],
          },
        },
      };

      const result = generateGlobalPlugins(api);
      expect(result.plugins).toEqual([
        {
          name: 'abcd', // name from plugin tag
          config: {
            some_config: ['something'],
          },
        },
        {
          name: 'key-auth',
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

      const operation = {};

      const generated = generateRequestValidatorPlugin(plugin, operation);

      expect(generated).toStrictEqual({
        name: 'request-validator',
        enabled: plugin.enabled,
        config: { version: 'draft4', ...plugin.config },
      });
    });

    it('should not add properties if they are not defined', () => {
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

      const operation = {};

      const generated = generateRequestValidatorPlugin(plugin, operation);

      expect(generated).toStrictEqual({
        name: 'request-validator',
        enabled: plugin.enabled,
        config: { version: 'draft4', ...plugin.config },
      });
    });

    describe('parameter_schema', () => {
      it('should not add parameter_schema if no parameters present', () => {
        const plugin = {
          enabled: true,
          config: {},
        };

        const generated1 = generateRequestValidatorPlugin(plugin, {});
        const generated2 = generateRequestValidatorPlugin(plugin, { parameters: [] });

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

        const param = {
          in: 'query',
          explode: true,
          required: false,
          name: 'some_name',
          schema: {
            anyOf: [{ type: 'string' }],
          },
          style: 'form',
        };

        const operation: OA3Operation = {
          parameters: [param],
        };

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
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

        const generated = generateRequestValidatorPlugin(plugin, operation);

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

      it('should ignore parameters without schema', () => {
        const plugin = {};
        const paramWithSchema = {
          in: 'query',
          explode: true,
          required: false,
          name: 'some_name',
          schema: {
            anyOf: [{ type: 'string' }],
          },
          style: 'form',
        };
        const paramWithoutSchema = {
          in: 'query',
          name: 'some_name',
        };
        const operation: OA3Operation = {
          parameters: [paramWithSchema, paramWithoutSchema],
        };

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
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

        const operation = {};

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
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

        const op1 = { requestBody: {} };
        const op2 = { requestBody: { $ref: 'non-existent' } };
        const op3 = {};

        expect(generateRequestValidatorPlugin(plugin, op1).config).toStrictEqual(defaultReqVal);
        expect(generateRequestValidatorPlugin(plugin, op2).config).toStrictEqual(defaultReqVal);
        expect(generateRequestValidatorPlugin(plugin, op3).config).toStrictEqual(defaultReqVal);
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

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
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

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: JSON.stringify(schemaJson),
          allowed_content_types: ['application/xml', 'application/json'],
        });
      });

      it('should default body_schema if no schema is defined or generated', () => {
        const plugin = {};
        const operation = {};

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: '{}',
        });
      });
    });
  });
});
