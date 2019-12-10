// @flow
import { generateServices } from '../services';
import { parseSpec } from '../common';

describe('services', () => {
  describe('generateServices()', () => {
    it('generates generic service with paths', async () => {
      const api: OpenApi3Spec = await parseSpec({
        openapi: '3.0',
        info: { version: '1.0', title: 'My API' },
        servers: [{ url: 'https://server1.com/path' }],
        paths: {
          '/dogs': {
            summary: 'Dog stuff',
            get: {},
            post: { summary: 'Create dog' },
          },
        },
      });

      const result = generateServices(api, ['Tag']);
      expect(result).toEqual([
        {
          host: 'My_API',
          name: 'My_API',
          path: '/',
          port: 443,
          protocol: 'https',
          tags: ['Tag'],
          routes: [
            {
              name: 'My_API-Dog_stuff-get',
              strip_path: false,
              methods: ['GET'],
              paths: ['/path/dogs$'],
              tags: ['Tag'],
            },
            {
              name: 'My_API-Dog_stuff-post',
              strip_path: false,
              methods: ['POST'],
              paths: ['/path/dogs$'],
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
  });
});
