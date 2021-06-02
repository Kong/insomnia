import { OA3SecurityScheme } from '../types/openapi3';
import { generateSecurityPlugin } from './security-plugins';
import { tags } from './jest/test-helpers';

describe('security-plugins', () => {
  describe('generateSecurityPlugin()', () => {
    it('generates apikey plugin', async () => {
      const scheme: OA3SecurityScheme = {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme, [], tags);
      expect(result).toEqual({
        name: 'key-auth',
        tags,
        config: {
          key_names: ['x-api-key'],
        },
      });
    });

    it('generates apikey plugin with funny casing', async () => {
      const scheme: OA3SecurityScheme = {
        // @ts-expect-error intentionally invalid -- using strange casing.  Yes, technically speaking the type of OA3SecurityScheme['type'] should be `string`, but we really only support strange casing like this for backwards compat.  We want the types to reflect the API we're aiming for, even though we're technically a bit more permissive.
        type: 'ApIKeY',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme, [], tags);
      expect(result).toEqual({
        name: 'key-auth',
        tags,
        config: {
          key_names: ['x-api-key'],
        },
      });
    });
  });
});
