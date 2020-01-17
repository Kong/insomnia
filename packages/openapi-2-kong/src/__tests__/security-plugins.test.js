import { generateSecurityPlugin } from '../security-plugins';

describe('security-plugins', () => {
  describe('generateSecurityPlugin()', () => {
    it('generates apikey plugin', async () => {
      const scheme = {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme);
      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
        },
      });
    });
    it('generates apikey plugin with funny casing', async () => {
      const scheme = {
        type: 'ApIKeY',
        in: 'header',
        name: 'x-api-key',
      };

      const result = generateSecurityPlugin(scheme);
      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
        },
      });
    });
  });
});
