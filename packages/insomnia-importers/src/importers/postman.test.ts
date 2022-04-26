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
    describe('bearer', () => {
      it('returns simple token', () => {
        // Arrange
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer {{token}}',
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);

        // Act
        const { authentication } = postman.importRequestItem({ request }, 'n/a');

        // Assert
        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '{{token}}',
          prefix: '',
        });
      });

      it('handles multiple spaces', () => {
        // Arrange
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer        {{token}}',
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);

        // Act
        const { authentication } = postman.importRequestItem({ request }, 'n/a');

        // Assert
        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '{{token}}',
          prefix: '',
        });
      });

      it('handles no token', () => {
        // Arrange
        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: 'Bearer ',
          }],
        };
        const schema = postmanSchema({ requests: [request] });
        const postman = new ImportPostman(schema);

        // Act
        const { authentication } = postman.importRequestItem({ request }, 'n/a');

        // Assert
        expect(authentication).toEqual({
          type: 'bearer',
          disabled: false,
          token: '',
          prefix: '',
        });
      });
    });

    describe('basic', () => {
      it('returns a simple basic auth', () => {
        // Arrange
        const username = 'ziltoid';
        const password = 'theOmniscient';
        const token = Buffer.from(`${username}:${password}`).toString();

        const request: Request1 = {
          header: [{
            key: 'Authorization',
            value: `Basic ${token}`,
          }],
        };

        const schema = postmanSchema({ requests: [request] });

        const postman = new ImportPostman(schema);

        // Act
        const { authentication } = postman.importRequestItem({ request }, 'n/a');

        // Assert
        expect(authentication).toEqual({
          type: 'basic',
          disabled: false,
          username: 'ziltoid',
          password: 'theOmniscient',
        });
      });
    });
  });

  describe('oauth2', () => {
    // Arrange
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

      // Act
      const { authentication } = postman.importRequestItem({ request }, 'n/a');

      // Assert
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

      // Act
      const { authentication } = postman.importRequestItem({ request }, 'n/a');

      // Assert
      expect(authentication).toEqual({
        accessTokenUrl: 'exampleAccessTokenUrl',
        authorizationUrl: 'exampleAuthorizeUrl',
        clientId: 'exampleClientId',
        clientSecret: 'exampleClientSecret',
        disabled: false,
        grantType: 'authorization_code',
        password: '',
        redirectUrl: 'exampleCallbackUrl',
        type: 'oauth2',
        username: '',
      });
    });
  });
});
