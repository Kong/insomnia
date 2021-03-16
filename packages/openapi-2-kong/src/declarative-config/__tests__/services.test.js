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
              paths: ['/cats'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-Dog_stuff-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/dogs'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-Dog_stuff-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/dogs'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-path_3-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/birds/(?<id>\\S+)$'],
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
