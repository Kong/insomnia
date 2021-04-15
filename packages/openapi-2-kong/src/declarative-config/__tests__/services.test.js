// @flow
import { generateServices } from '../services';
import { parseSpec } from '../../index';

describe('services', () => {
  describe('generateServices()', () => {
    it('generates generic service with paths', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        servers: [{ url: 'https://server1.com/path' }],
        paths: {
          '/cats': {
            'x-kong-name': 'Cat stuff',
            summary: 'summary is ignored',
            post: {},
          },
          '/dogs': {
            summary: 'Dog stuff',
            get: {},
            post: { summary: 'Ignored summary' },
          },
          '/birds/{id}': {
            get: {},
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-Cat_stuff-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/cats$'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-dogs-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/dogs$'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-birds_id-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/birds/(?<id>[^\\/\\s]+)$'],
              tags: ['Tag'],
            },
          ],
        },
      ]);
    });

    it('generates routes with request validator plugin from operation over path over global', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        'x-kong-plugin-request-validator': { config: { parameter_schema: 'global' } }, // global req validator plugin
        servers: [
          {
            url: 'https://server1.com/path',
          },
        ],
        paths: {
          '/dogs': {
            summary: 'Dog stuff',
            get: {},
            post: {
              summary: 'Ignored summary',
              'x-kong-plugin-request-validator': {
                // operation req validator plugin
                config: { parameter_schema: 'operation' },
              },
            },
          },
          '/cats': {
            summary: 'Dog stuff',
            'x-kong-plugin-request-validator': { config: { parameter_schema: 'path' } }, // path req validator plugin
            get: {},
            post: {
              'x-kong-plugin-request-validator': {
                config: { parameter_schema: 'operation' }, // operation req validator plugin
              },
            },
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
              plugins: [
                {
                  name: 'request-validator',
                  // should apply global plugin
                  config: { parameter_schema: 'global', version: 'draft4' },
                  enabled: true,
                },
              ],
            },
            {
              name: 'My_API-dogs-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/dogs$'],
              tags: ['Tag'],
              plugins: [
                {
                  // should have operation plugin
                  config: { parameter_schema: 'operation', version: 'draft4' },
                  enabled: true,
                  name: 'request-validator',
                },
              ],
            },
            {
              name: 'My_API-cats-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/cats$'],
              tags: ['Tag'],
              plugins: [
                {
                  name: 'request-validator',
                  // should apply path plugin
                  config: { parameter_schema: 'path', version: 'draft4' },
                  enabled: true,
                },
              ],
            },
            {
              name: 'My_API-cats-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/cats$'],
              tags: ['Tag'],
              plugins: [
                {
                  // should have operation plugin
                  config: { parameter_schema: 'operation', version: 'draft4' },
                  enabled: true,
                  name: 'request-validator',
                },
              ],
            },
          ],
        },
      ]);
    });

    it('generates routes with request validator plugin from server over global', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        'x-kong-plugin-request-validator': { config: { parameter_schema: 'global' } }, // global req validator plugin
        servers: [
          {
            url: 'https://server1.com/path',
            'x-kong-plugin-request-validator': { config: { parameter_schema: 'server' } }, // server req validator plugin
          },
        ],
        paths: {
          '/dogs': {
            summary: 'Dog stuff',
            get: {},
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
              plugins: [
                {
                  name: 'request-validator',
                  // should apply server plugin
                  config: { parameter_schema: 'server', version: 'draft4' },
                  enabled: true,
                },
              ],
            },
          ],
        },
      ]);
    });

    it('generates routes with plugins from operation over path', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        servers: [
          {
            url: 'https://server1.com/path',
          },
        ],
        paths: {
          '/dogs': {
            summary: 'Dog stuff',
            'x-kong-plugin-key-auth': {
              config: {
                key_names: ['path'],
              },
            },
            get: {},
            post: {
              'x-kong-plugin-key-auth': {
                config: {
                  key_names: ['operation'],
                },
              },
            },
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
              plugins: [
                {
                  name: 'key-auth',
                  // should apply path plugin
                  config: { key_names: ['path'] },
                },
              ],
            },
            {
              name: 'My_API-dogs-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/dogs$'],
              tags: ['Tag'],
              plugins: [
                {
                  name: 'key-auth',
                  // should apply path plugin
                  config: { key_names: ['operation'] },
                },
              ],
            },
          ],
        },
      ]);
    });

    it('generates service with plugins from server over global', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        summary: 'Dog stuff',
        'x-kong-plugin-key-auth': {
          config: {
            key_names: ['global'],
          },
        },
        servers: [
          {
            url: 'https://server1.com/path',
            'x-kong-plugin-key-auth': {
              config: {
                key_names: ['server'],
              },
            },
          },
        ],
        paths: {
          '/dogs': {
            get: {},
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [
            {
              name: 'key-auth',
              // should apply path plugin
              config: { key_names: ['server'] },
            },
          ],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
            },
          ],
        },
      ]);
    });

    it('generates service with plugins from server over global', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        summary: 'Dog stuff',
        'x-kong-plugin-key-auth': {
          config: {
            key_names: ['global'],
          },
        },
        servers: [
          {
            url: 'https://server1.com/path',
          },
        ],
        paths: {
          '/dogs': {
            get: {},
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://server1.com/path',
          plugins: [
            {
              name: 'key-auth',
              // should apply path plugin
              config: { key_names: ['global'] },
            },
          ],
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-dogs-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs$'],
              tags: ['Tag'],
            },
          ],
        },
      ]);
    });

    it('fails with no servers', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        paths: {
          '/dogs': {
            summary: 'Dog stuff',
            get: {},
            post: { summary: 'Create dog' },
          },
        },
      });

      const fn = () => generateServices(api, ['Tag']);
      expect(fn).toThrowError('no servers defined in spec');
    });

    it('replaces variables', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        servers: [
          {
            url: 'https://{customerId}.saas-app.com:{port}/v2',
            variables: {
              customerId: { default: 'demo' },
              port: { enum: ['443', '8443'], default: '8443' },
            },
          },
        ],
        paths: {},
      });

      const result = await generateServices(api, []);
      expect(result).toEqual([
        {
          name: 'My_API',
          url: 'https://demo.saas-app.com:8443/v2',
          plugins: [],
          routes: [],
          tags: [],
        },
      ]);
    });
  });
});
