// @flow

import { generateServerPlugins, generatePlugin } from '../plugins';

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
});
