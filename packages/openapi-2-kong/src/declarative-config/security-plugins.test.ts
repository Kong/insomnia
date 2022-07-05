import { describe, expect, it } from '@jest/globals';
import { OpenAPIV3 } from 'openapi-types';

import { OA3SecurityScheme } from '../types/openapi3';
import { tags } from './jest/test-helpers';
import { generateSecurityPlugin } from './security-plugins';

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

    it('concatenates kongSecurity config', async () => {
      const scheme = {
        name: 'ziltoid',
        type: 'openIdConnect',
        openIdConnectUrl: 'https://idp-endpoint.example.com/.well-kown',
        'x-kong-security-openid-connect': {
          config: {
            'auth_methods': ['bearer'],
          },
          enabled: true,
          protocols: ['http', 'https'],
        },
      } as OpenAPIV3.OpenIdSecurityScheme;

      const scopesRequired = ['required_scope', 'ziltoid_omniscient_power'];
      const result = generateSecurityPlugin(scheme, scopesRequired, tags);
      expect(result).toMatchObject({
        name: 'openid-connect',
        config: {
          issuer: 'https://idp-endpoint.example.com/.well-kown',
          'scopes_required': scopesRequired,
          'auth_methods': [
            'bearer',
          ],
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
