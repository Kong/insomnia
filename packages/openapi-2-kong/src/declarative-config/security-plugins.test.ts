import { OA3SecurityScheme } from '../types/openapi3';
import { generateSecurityPlugin } from './security-plugins';

describe('security-plugins', () => {
  describe('generateSecurityPlugin()', () => {
    it('generates apikey plugin', async () => {
      const scheme: OA3SecurityScheme = {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme, [], ['Tag']);
      expect(result).toEqual({
        name: 'key-auth',
        tags: ['Tag'],
        config: {
          key_names: ['x-api-key'],
        },
      });
    });

    it('generates apikey plugin with funny casing', async () => {
      const scheme: OA3SecurityScheme = {
        type: 'ApIKeY',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme, [], ['Tag']);
      expect(result).toEqual({
        name: 'key-auth',
        tags: ['Tag'],
        config: {
          key_names: ['x-api-key'],
        },
      });
    });
  });
});
