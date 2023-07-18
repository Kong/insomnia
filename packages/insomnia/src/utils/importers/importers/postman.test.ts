import { describe, expect, it } from '@jest/globals';

import { ImportPostman } from './postman';
import { HttpsSchemaGetpostmanComJsonCollectionV210, Request1 } from './postman-2.1.types';

describe('postman', () => {
  const postmanSchema = ({
    requests = [],
    version = 'v2.0.0',
  }: {
    requests?: Request1[];
    version?: string;
  } = {}) => JSON.parse(JSON.stringify({
    info: {
      name: 'Postman Schema',
      schema: `https:\/\/schema.getpostman.com\/json\/collection\/${version}\/collection.json`,
    },
    item: [
      {
        request: {},
        name: 'Projects',
        item: [
          ...requests,
          {
            name: 'Request 1',
            request: {

            },
          },
        ],
      },
    ],
  })) as HttpsSchemaGetpostmanComJsonCollectionV210;

  describe('headers', () => {
    describe('properties', () => {
      it('should import headers with all properties', () => {
        const request: Request1 = {
          header: [
            {
              key: 'X-Header1',
              value: 'value1',
              description: 'description1',
            },
            {
              key: 'X-Header2',
              value: 'value2',
              disabled: true,
            },
          ],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { headers } = postman.importRequestItem({ request }, 'n/a');

        expect(headers).toEqual([
          {
            name: 'X-Header1',
            value: 'value1',
            description: 'description1',
          },
          {
            name: 'X-Header2',
            value: 'value2',
            disabled: true,
          },
        ]);
      });
    });

    describe('awsv4', () => {
      it('should not duplicate headers', () => {
        const request: Request1 = {
          header: [
            {
              key: 'Authorization',
              value: 'AWS4-HMAC-SHA256 Credential=<accessKeyId>/20220110/<region>/<service>/aws4_request, SignedHeaders=accept;content-type;host;x-amz-date;x-amz-security-token, Signature=ed270ed6ad1cad3513f6edad9692e4496e321e44954c70a86504eea5e0ef1ff5',
            },
            {
              key: 'X-Amz-Security-Token',
              value: 'someTokenSomethingSomething',
            },
          ],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          accessKeyId: '<accessKeyId>',
          disabled: false,
          region: '<region>',
          secretAccessKey: '',
          service: '<service>',
          sessionToken: 'someTokenSomethingSomething',
          type: 'iam',
        });
        expect(headers).toEqual([]);
      });
    });

    describe('basic', () => {
      it('returns a simple basic auth and does not duplicate authorization header', () => {
        const username = 'ziltoid';
        const password = 'theOmniscient';
        const token = Buffer.from(`${username}:${password}`).toString('base64');
        const nonAuthHeader = {
          key: 'Another-key',
          value: 'Another-value',
        };
        const request: Request1 = {
          header: [
            {
              key: 'Authorization',
              value: `Basic ${token}`,
            },
            nonAuthHeader,
          ],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          type: 'basic',
          disabled: false,
          username: 'ziltoid',
          password: 'theOmniscient',
        });
        expect(headers).toEqual([{
          name: nonAuthHeader.key,
          value: nonAuthHeader.value,
        }]);
      });
    });

    describe('bearer', () => {
      it('returns simple token', () => {
        const nonAuthHeader = {
          key: 'Another-key',
          value: 'Another-value',
        };
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer {{token}}',
          }, nonAuthHeader],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '{{token}}',
          prefix: '',
        });
        expect(headers).toEqual([{
          name: nonAuthHeader.key,
          value: nonAuthHeader.value,
        }]);
      });

      it('handles multiple spaces', () => {
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer        {{token}}',
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '{{token}}',
          prefix: '',
        });
      });

      it('handles no token', () => {
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer ',
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '',
          prefix: '',
        });
        expect(headers).toEqual([]);
      });
    });

    describe('digest', () => {
      it('returns simple digest authentication', () => {
        const username = 'Gandalf';
        const digest = `Digest username="${username}", realm="Realm", nonce="Nonce", uri="//api/v1/report?start_date_min=2019-01-01T00%3A00%3A00%2B00%3A00&start_date_max=2019-01-01T23%3A59%3A59%2B00%3A00&projects[]=%2Fprojects%2F1&include_child_projects=1&search_query=meeting&columns[]=project&include_project_data=1&sort[]=-duration", algorithm="MD5", response="f3f762321e158aefe103529eda4ddb7c", opaque="Opaque"`;
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: digest,
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          type: 'digest',
          disabled: false,
          username: username,
          password: '',
        });
        expect(headers).toEqual([]);
      });
    });

    describe('oauth1', () => {
      it('returns simple oauth1 authentication', () => {
        const oauth1 = 'OAuth realm="Realm",oauth_consumer_key="Consumer%20Key",oauth_token="Access%20Token",oauth_signature_method="HMAC-SHA1",oauth_timestamp="Timestamp",oauth_nonce="Nonce",oauth_version="Version",oauth_callback="Callback%20URL",oauth_verifier="Verifier",oauth_signature="TwJvZVasVWTL6X%2Bz3lmuiyvaX2Q%3D"';
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: oauth1,
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);
        const { authentication, headers } = postman.importRequestItem({ request }, 'n/a');

        expect(authentication).toEqual({
          callback: 'Callback%20URL',
          consumerKey: 'Consumer%20Key',
          consumerSecret: '',
          disabled: false,
          nonce: 'Nonce',
          privateKey: '',
          realm: 'Realm',
          signatureMethod: 'HMAC-SHA1',
          timestamp: 'Timestamp',
          tokenKey: 'Access%20Token',
          tokenSecret: '',
          type: 'oauth1',
          verifier: 'Verifier',
          version: 'Version',
        });
        expect(headers).toEqual([]);
      });
    });

    describe('oauth2', () => {
      // we don't have a importOauth2AuthenticationFromHeader with which to write a test for since importBearerAuthenticationFromHeader handles this case
    });
  });

  describe('oauth2', () => {
    const request: Request1 = {
      auth: {
        type: 'oauth2',
        oauth2: [
          {
            key: 'clientSecret',
            value: 'exampleClientSecret',
            type: 'string',
          },
          {
            key: 'clientId',
            value: 'exampleClientId',
            type: 'string',
          },
          {
            key: 'accessTokenUrl',
            value: 'exampleAccessTokenUrl',
            type: 'string',
          },
          {
            key: 'authUrl',
            value: 'exampleAuthorizeUrl',
            type: 'string',
          },
          {
            key: 'redirect_uri',
            value: 'exampleCallbackUrl',
            type: 'string',
          },
          {
            key: 'grant_type',
            value: 'authorization_code',
            type: 'string',
          },
          {
            key: 'tokenName',
            value: 'Access token',
            type: 'string',
          },
          {
            key: 'challengeAlgorithm',
            value: 'S256',
            type: 'string',
          },
          {
            key: 'addTokenTo',
            value: 'header',
            type: 'string',
          },
          {
            key: 'client_authentication',
            value: 'header',
            type: 'string',
          },
        ],
      },
    };

    it('returns empty oauth2 if Postman v2.0.0', () => {
      const schema = postmanSchema({ requests: [request], version: 'v2.0.0' });
      const postman = new ImportPostman(schema);
      const { authentication } = postman.importRequestItem({ request }, 'n/a');

      expect(authentication).toEqual({
        accessTokenUrl: '',
        authorizationUrl: '',
        disabled: true,
        grantType: 'authorization_code',
        password: '',
        type: 'oauth2',
        username: '',
      });
    });

    it('returns oauth2 if Postman v2.1.0', () => {
      const schema = postmanSchema({ requests: [request], version: 'v2.1.0' });
      const postman = new ImportPostman(schema);
      const { authentication } = postman.importRequestItem({ request }, 'n/a');

      expect(authentication).toEqual({
        accessTokenUrl: 'exampleAccessTokenUrl',
        authorizationUrl: 'exampleAuthorizeUrl',
        clientId: 'exampleClientId',
        clientSecret: 'exampleClientSecret',
        credentialsInBody: false,
        disabled: false,
        grantType: 'authorization_code',
        password: '',
        pkceMethod: 'S256',
        redirectUrl: 'exampleCallbackUrl',
        scope: '',
        state: '',
        tokenPrefix: '',
        type: 'oauth2',
        usePkce: undefined,
        username: '',
      });
    });

    it('returns oauth2 for Postman v2.1.0 with PKCE', () => {
      const requestWithPCKE: Request1 = {
        'auth': {
          'type': 'oauth2',
          'oauth2': [
            {
              'key': 'state',
              'value': '1234567890',
              'type': 'string',
            },
            {
              'key': 'scope',
              'value': 'read:org',
              'type': 'string',
            },
            {
              'key': 'clientSecret',
              'value': '1234567890',
              'type': 'string',
            },
            {
              'key': 'clientId',
              'value': '1234567890',
              'type': 'string',
            },
            {
              'key': 'accessTokenUrl',
              'value': 'https://accounts.google.com/o/oauth2/token',
              'type': 'string',
            },
            {
              'key': 'authUrl',
              'value': 'https://accounts.google.com/o/oauth2/auth',
              'type': 'string',
            },
            {
              'key': 'grant_type',
              'value': 'authorization_code_with_pkce',
              'type': 'string',
            },
            {
              'key': 'tokenName',
              'value': 'Test',
              'type': 'string',
            },
            {
              'key': 'challengeAlgorithm',
              'value': 'S256',
              'type': 'string',
            },
            {
              'key': 'addTokenTo',
              'value': 'queryParams',
              'type': 'string',
            },
            {
              'key': 'client_authentication',
              'value': 'header',
              'type': 'string',
            },
            {
              key: 'redirect_uri',
              value: 'exampleCallbackUrl',
              type: 'string',
            },
          ],
        },
        'method': 'GET',
        'header': [],
        'url': {
          'raw': 'https://mockbin.org/echo',
          'protocol': 'https',
          'host': [
            'mockbin',
            'org',
          ],
          'path': [
            'echo',
          ],
        },
      };
      const schema = postmanSchema({ requests: [requestWithPCKE], version: 'v2.1.0' });
      const postman = new ImportPostman(schema);
      const { authentication } = postman.importRequestItem({ request: requestWithPCKE }, 'n/a');

      expect(authentication).toEqual({
        accessTokenUrl: 'https://accounts.google.com/o/oauth2/token',
        authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
        clientId: '1234567890',
        clientSecret: '1234567890',
        credentialsInBody: true,
        disabled: false,
        grantType: 'authorization_code',
        password: '',
        pkceMethod: 'S256',
        redirectUrl: 'exampleCallbackUrl',
        scope: 'read:org',
        state: '1234567890',
        tokenPrefix: '',
        type: 'oauth2',
        usePkce: true,
        username: '',
      });
    });
  });
});
