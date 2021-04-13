// @flow

import { generateServerPlugins, generatePlugin, generateRequestValidatorPlugin } from '../plugins';

describe('plugins', () => {
  describe('generateServerPlugins()', () => {
    it('generates plugin given a server with a plugin attached', async () => {
      const server = {
        url: 'https://insomnia.rest',
        'x-kong-plugin-key-auth': {
          name: 'key-auth',
          config: {
            key_names: ['x-api-key'],
          },
        },
      };

      const result = generateServerPlugins(server);
      expect(result).toEqual([
        {
          name: 'key-auth',
          config: {
            key_names: ['x-api-key'],
          },
        },
      ]);
    });
  });

  describe('generatePlugin()', () => {
    it('generates plugin given a plugin key, and value', async () => {
      const pluginKey = 'x-kong-plugin-key-auth';
      const pluginValue = {
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
        },
      };

      const result = generatePlugin(pluginKey, pluginValue);
      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
        },
      });
    });

    it('generates name from key when missing `name` from value', async () => {
      const pluginKey = 'x-kong-plugin-key-auth';
      const pluginValue = {
        config: {
          key_names: ['x-api-key'],
        },
      };

      const result = generatePlugin(pluginKey, pluginValue);
      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
        },
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
          allowed_content_types: 'application/json',
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
          // allowed_content_types: 'application/json',
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
      it('should return empty array for parameter schema if no parameters exist in operation', () => {
        const plugin = {
          enabled: true,
          config: {},
        };

        const operation = {};

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated).toStrictEqual({
          name: 'request-validator',
          enabled: plugin.enabled,
          config: { version: 'draft4', parameter_schema: [] },
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

      it('should throw error if no operation parameter schema defined', () => {
        const plugin = {};

        const operation: OA3Operation = {
          parameters: [
            {
              in: 'query',
              name: 'some_name',
            },
          ],
        };

        expect(() => generateRequestValidatorPlugin(plugin, operation)).toThrowError(
          "Parameter using 'content' type validation is not supported",
        );
      });
    });

    describe('body_schema', () => {
      it('should not add body_schema if no body present', () => {
        const plugin = {
          config: {},
        };

        const operation = {};

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
          version: 'draft4',
          parameter_schema: [],
        });
      });

      it('should throw error if no operation request body content defined', () => {
        const plugin = {};

        const operation: OA3Operation = {
          requestBody: {},
        };

        expect(() => generateRequestValidatorPlugin(plugin, operation)).toThrowError(
          'content property is missing for request-validator!',
        );
      });

      it('should throw error if operation request body content is not json', () => {
        const plugin = {};

        const operation: OA3Operation = {
          requestBody: {
            content: {
              'application/xml': {},
              'text/yaml': {},
            },
          },
        };

        // just fails on the first one
        expect(() => generateRequestValidatorPlugin(plugin, operation)).toThrowError(
          `Body validation supports only 'application/json', not application/xml`,
        );
      });

      it('should add body_schema', () => {
        const plugin = {};

        const schema = {
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
              'application/json': {
                schema,
              },
            },
          },
        };

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: JSON.stringify(schema),
          parameter_schema: [],
        });
      });

      // This currently throws an error but it should pass
      it.skip('should add body_schema for JSON only', () => {
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
                schemaXml,
              },
              'application/json': {
                schemaJson,
              },
            },
          },
        };

        const generated = generateRequestValidatorPlugin(plugin, operation);

        expect(generated.config).toStrictEqual({
          version: 'draft4',
          body_schema: JSON.stringify(schemaJson),
          parameter_schema: [],
        });
      });
    });
  });
});
