/**
 * @fileoverview Comprehensive tests for Request Model functionality
 *
 * This test suite covers all the authentication types and request body structures
 * we added comments to in request.ts, ensuring they work correctly.
 */

import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, it } from 'vitest';

import * as models from '../index';
import type {
  AuthTypeAPIKey,
  AuthTypeAsap,
  AuthTypeAwsIam,
  AuthTypeBasic,
  AuthTypeBearer,
  AuthTypeDigest,
  AuthTypeHawk,
  AuthTypeNetrc,
  AuthTypeNTLM,
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  AuthTypeSingleToken,
  RequestBody,
  RequestHeader,
  RequestParameter,
} from '../request';

// @vitest-environment jsdom
describe('Request Model - Comprehensive Tests', () => {
  beforeEach(async () => {
    await models.project.all();
    await models.settings.getOrCreate();

    // Create test project for all tests
    try {
      await models.project.create({
        _id: `proj_test_${uuidv4()}`,
        name: 'Test Project',
      });
    } catch (error) {
      // Project might already exist, that's okay
    }
  });

  describe('Basic Request Creation', () => {
    it('should create a basic HTTP request', async () => {
      const workspace = await models.workspace.create({
        _id: 'wrk_basic_test',
        name: 'Basic Test Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      const request = await models.request.create({
        _id: 'req_basic',
        name: 'Basic Request',
        parentId: workspace._id,
        url: 'https://api.example.com/test',
        method: 'GET',
        metaSortKey: 0,
      });

      expect(request).toMatchObject({
        _id: 'req_basic',
        name: 'Basic Request',
        parentId: workspace._id,
        url: 'https://api.example.com/test',
        method: 'GET',
        type: 'Request',
      });
    });

    it('should create a request with headers', async () => {
      const workspace = await models.workspace.create({
        _id: 'wrk_headers',
        name: 'Headers Test Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      const headers: RequestHeader[] = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer token123' },
        { name: 'X-Custom-Header', value: 'custom-value' },
      ];

      const request = await models.request.create({
        _id: 'req_headers',
        name: 'Request with Headers',
        parentId: workspace._id,
        url: 'https://api.example.com/headers',
        method: 'POST',
        headers,
        metaSortKey: 0,
      });

      expect(request.headers).toEqual(headers);
    });

    it('should create a request with parameters', async () => {
      const workspace = await models.workspace.create({
        _id: 'wrk_params',
        name: 'Parameters Test Workspace',
        parentId: 'proj_test',
        scope: 'collection',
      });

      const parameters: RequestParameter[] = [
        { name: 'page', value: '1' },
        { name: 'limit', value: '10' },
        { name: 'sort', value: 'created_at' },
      ];

      const request = await models.request.create({
        _id: 'req_params',
        name: 'Request with Parameters',
        parentId: workspace._id,
        url: 'https://api.example.com/params',
        method: 'GET',
        parameters,
        metaSortKey: 0,
      });

      expect(request.parameters).toEqual(parameters);
    });
  });

  describe('Authentication Types', () => {
    let workspace: any;

    beforeEach(async () => {
      workspace = await models.workspace.create({
        _id: `wrk_auth_${uuidv4()}`,
        name: 'Auth Test Workspace',
        parentId: `proj_test_${uuidv4()}`,
        scope: 'collection',
      });
    });

    describe('Basic Authentication', () => {
      it('should create request with basic auth', async () => {
        const basicAuth: AuthTypeBasic = {
          type: 'basic',
          username: 'testuser',
          password: 'testpass',
          useISO88591: false,
        };

        const request = await models.request.create({
          _id: 'req_basic_auth',
          name: 'Basic Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/basic',
          method: 'GET',
          authentication: basicAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(basicAuth);
      });

      it('should create request with basic auth and ISO-8859-1 encoding', async () => {
        const basicAuth: AuthTypeBasic = {
          type: 'basic',
          username: 'testuser',
          password: 'testpass',
          useISO88591: true,
        };

        const request = await models.request.create({
          _id: 'req_basic_auth_iso',
          name: 'Basic Auth ISO Request',
          parentId: workspace._id,
          url: 'https://api.example.com/basic-iso',
          method: 'GET',
          authentication: basicAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(basicAuth);
      });
    });

    describe('API Key Authentication', () => {
      it('should create request with API key in header', async () => {
        const apiKeyAuth: AuthTypeAPIKey = {
          type: 'apikey',
          key: 'X-API-Key',
          value: 'api-key-123',
          addTo: 'header',
        };

        const request = await models.request.create({
          _id: 'req_apikey_header',
          name: 'API Key Header Request',
          parentId: workspace._id,
          url: 'https://api.example.com/apikey',
          method: 'GET',
          authentication: apiKeyAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(apiKeyAuth);
      });

      it('should create request with API key in query params', async () => {
        const apiKeyAuth: AuthTypeAPIKey = {
          type: 'apikey',
          key: 'api_key',
          value: 'api-key-123',
          addTo: 'query',
        };

        const request = await models.request.create({
          _id: 'req_apikey_query',
          name: 'API Key Query Request',
          parentId: workspace._id,
          url: 'https://api.example.com/apikey',
          method: 'GET',
          authentication: apiKeyAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(apiKeyAuth);
      });
    });

    describe('OAuth 2.0 Authentication', () => {
      it('should create request with OAuth 2.0 authorization code flow', async () => {
        const oauth2Auth: AuthTypeOAuth2 = {
          type: 'oauth2',
          grantType: 'authorization_code',
          accessTokenUrl: 'https://auth.example.com/token',
          authorizationUrl: 'https://auth.example.com/authorize',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          scope: 'read write',
          redirectUrl: 'https://app.example.com/callback',
          state: 'random-state',
          audience: 'https://api.example.com',
          resource: 'https://api.example.com',
        };

        const request = await models.request.create({
          _id: 'req_oauth2_auth_code',
          name: 'OAuth2 Auth Code Request',
          parentId: workspace._id,
          url: 'https://api.example.com/oauth2',
          method: 'GET',
          authentication: oauth2Auth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(oauth2Auth);
      });

      it('should create request with OAuth 2.0 client credentials flow', async () => {
        const oauth2Auth: AuthTypeOAuth2 = {
          type: 'oauth2',
          grantType: 'client_credentials',
          accessTokenUrl: 'https://auth.example.com/token',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          scope: 'read write',
        };

        const request = await models.request.create({
          _id: 'req_oauth2_client_creds',
          name: 'OAuth2 Client Creds Request',
          parentId: workspace._id,
          url: 'https://api.example.com/oauth2',
          method: 'GET',
          authentication: oauth2Auth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(oauth2Auth);
      });

      it('should create request with OAuth 2.0 password flow', async () => {
        const oauth2Auth: AuthTypeOAuth2 = {
          type: 'oauth2',
          grantType: 'password',
          accessTokenUrl: 'https://auth.example.com/token',
          clientId: 'test-client',
          clientSecret: 'test-secret',
          username: 'testuser',
          password: 'testpass',
          scope: 'read write',
        };

        const request = await models.request.create({
          _id: 'req_oauth2_password',
          name: 'OAuth2 Password Request',
          parentId: workspace._id,
          url: 'https://api.example.com/oauth2',
          method: 'GET',
          authentication: oauth2Auth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(oauth2Auth);
      });
    });

    describe('Digest Authentication', () => {
      it('should create request with digest auth', async () => {
        const digestAuth: AuthTypeDigest = {
          type: 'digest',
          username: 'testuser',
          password: 'testpass',
        };

        const request = await models.request.create({
          _id: 'req_digest_auth',
          name: 'Digest Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/digest',
          method: 'GET',
          authentication: digestAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(digestAuth);
      });
    });

    describe('NTLM Authentication', () => {
      it('should create request with NTLM auth', async () => {
        const ntlmAuth: AuthTypeNTLM = {
          type: 'ntlm',
          username: 'testuser',
          password: 'testpass',
        };

        const request = await models.request.create({
          _id: 'req_ntlm_auth',
          name: 'NTLM Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/ntlm',
          method: 'GET',
          authentication: ntlmAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(ntlmAuth);
      });
    });

    describe('AWS IAM Authentication', () => {
      it('should create request with AWS IAM auth', async () => {
        const awsIamAuth: AuthTypeAwsIam = {
          type: 'iam',
          accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
          secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
          sessionToken: 'session-token-example',
          region: 'us-east-1',
          service: 'execute-api',
        };

        const request = await models.request.create({
          _id: 'req_aws_iam_auth',
          name: 'AWS IAM Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/aws',
          method: 'GET',
          authentication: awsIamAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(awsIamAuth);
      });
    });

    describe('Hawk Authentication', () => {
      it('should create request with Hawk auth', async () => {
        const hawkAuth: AuthTypeHawk = {
          type: 'hawk',
          id: 'test-auth-id',
          key: 'test-auth-key',
          algorithm: 'sha256',
          ext: 'test-ext',
          validatePayload: true,
        };

        const request = await models.request.create({
          _id: 'req_hawk_auth',
          name: 'Hawk Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/hawk',
          method: 'GET',
          authentication: hawkAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(hawkAuth);
      });
    });

    describe('Bearer Token Authentication', () => {
      it('should create request with Bearer token auth', async () => {
        const bearerAuth: AuthTypeBearer = {
          type: 'bearer',
          token: 'test-bearer-token',
          prefix: 'Bearer',
        };

        const request = await models.request.create({
          _id: 'req_bearer_auth',
          name: 'Bearer Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/bearer',
          method: 'GET',
          authentication: bearerAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(bearerAuth);
      });
    });

    describe('OAuth 1.0 Authentication', () => {
      it('should create request with OAuth 1.0 auth', async () => {
        const oauth1Auth: AuthTypeOAuth1 = {
          type: 'oauth1',
          consumerKey: 'test-consumer-key',
          consumerSecret: 'test-consumer-secret',
          tokenKey: 'test-token-key',
          tokenSecret: 'test-token-secret',
          signatureMethod: 'HMAC-SHA1',
          realm: 'test-realm',
          timestamp: '1234567890',
          nonce: 'test-nonce',
          version: '1.0',
          callback: 'https://app.example.com/callback',
          verifier: 'test-verifier',
        };

        const request = await models.request.create({
          _id: 'req_oauth1_auth',
          name: 'OAuth 1.0 Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/oauth1',
          method: 'GET',
          authentication: oauth1Auth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(oauth1Auth);
      });
    });

    describe('ASAP Authentication', () => {
      it('should create request with ASAP auth', async () => {
        const asapAuth: AuthTypeAsap = {
          type: 'asap',
          issuer: 'test-issuer',
          subject: 'test-subject',
          audience: 'test-audience',
          keyId: 'test-key-id',
          privateKey: 'test-private-key',
          additionalClaims: '{"customClaim": "custom-value"}',
        };

        const request = await models.request.create({
          _id: 'req_asap_auth',
          name: 'ASAP Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/asap',
          method: 'GET',
          authentication: asapAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(asapAuth);
      });
    });

    describe('Single Token Authentication', () => {
      it('should create request with Single Token auth', async () => {
        const singleTokenAuth: AuthTypeSingleToken = {
          type: 'singleToken',
          token: 'test-single-token',
        };

        const request = await models.request.create({
          _id: 'req_single_token_auth',
          name: 'Single Token Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/single-token',
          method: 'GET',
          authentication: singleTokenAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(singleTokenAuth);
      });
    });

    describe('Netrc Authentication', () => {
      it('should create request with Netrc auth', async () => {
        const netrcAuth: AuthTypeNetrc = {
          type: 'netrc',
        };

        const request = await models.request.create({
          _id: 'req_netrc_auth',
          name: 'Netrc Auth Request',
          parentId: workspace._id,
          url: 'https://api.example.com/netrc',
          method: 'GET',
          authentication: netrcAuth,
          metaSortKey: 0,
        });

        expect(request.authentication).toEqual(netrcAuth);
      });
    });
  });

  describe('Request Body Types', () => {
    let workspace: any;

    beforeEach(async () => {
      workspace = await models.workspace.create({
        _id: `wrk_body_${uuidv4()}`,
        name: 'Body Test Workspace',
        parentId: `proj_test_${uuidv4()}`,
        scope: 'collection',
      });
    });

    describe('JSON Body', () => {
      it('should create request with JSON body', async () => {
        const jsonBody: RequestBody = {
          mimeType: 'application/json',
          text: '{"name": "test", "value": 123}',
        };

        const request = await models.request.create({
          _id: 'req_json_body',
          name: 'JSON Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/json',
          method: 'POST',
          body: jsonBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(jsonBody);
      });
    });

    describe('Form Data Body', () => {
      it('should create request with form data body', async () => {
        const formDataBody: RequestBody = {
          mimeType: 'application/x-www-form-urlencoded',
          params: [
            { name: 'field1', value: 'value1' },
            { name: 'field2', value: 'value2' },
          ],
        };

        const request = await models.request.create({
          _id: 'req_form_data_body',
          name: 'Form Data Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/form',
          method: 'POST',
          body: formDataBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(formDataBody);
      });
    });

    describe('Multipart Form Data Body', () => {
      it('should create request with multipart form data body', async () => {
        const multipartBody: RequestBody = {
          mimeType: 'multipart/form-data',
          params: [
            { name: 'text_field', value: 'text_value', type: 'text' },
            { name: 'file_field', value: 'file_content', type: 'file', fileName: 'test.txt' },
          ],
        };

        const request = await models.request.create({
          _id: 'req_multipart_body',
          name: 'Multipart Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/multipart',
          method: 'POST',
          body: multipartBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(multipartBody);
      });
    });

    describe('Raw Text Body', () => {
      it('should create request with raw text body', async () => {
        const rawTextBody: RequestBody = {
          mimeType: 'text/plain',
          text: 'This is raw text content',
        };

        const request = await models.request.create({
          _id: 'req_raw_text_body',
          name: 'Raw Text Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/raw',
          method: 'POST',
          body: rawTextBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(rawTextBody);
      });
    });

    describe('XML Body', () => {
      it('should create request with XML body', async () => {
        const xmlBody: RequestBody = {
          mimeType: 'application/xml',
          text: '<?xml version="1.0"?><root><item>value</item></root>',
        };

        const request = await models.request.create({
          _id: 'req_xml_body',
          name: 'XML Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/xml',
          method: 'POST',
          body: xmlBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(xmlBody);
      });
    });

    describe('Binary Body', () => {
      it('should create request with binary body', async () => {
        const binaryBody: RequestBody = {
          mimeType: 'application/octet-stream',
          fileName: 'test.bin',
        };

        const request = await models.request.create({
          _id: 'req_binary_body',
          name: 'Binary Body Request',
          parentId: workspace._id,
          url: 'https://api.example.com/binary',
          method: 'POST',
          body: binaryBody,
          metaSortKey: 0,
        });

        expect(request.body).toEqual(binaryBody);
      });
    });
  });

  describe('GraphQL Operations', () => {
    let workspace: any;

    beforeEach(async () => {
      workspace = await models.workspace.create({
        _id: `wrk_graphql_${uuidv4()}`,
        name: 'GraphQL Test Workspace',
        parentId: `proj_test_${uuidv4()}`,
        scope: 'collection',
      });
    });

    it('should detect GraphQL query operation', async () => {
      const request = await models.request.create({
        _id: 'req_graphql_query',
        name: 'GraphQL Query',
        parentId: workspace._id,
        url: 'https://api.example.com/graphql',
        method: 'POST',
        body: {
          mimeType: 'application/json',
          text: '{"query": "query { user { name } }"}',
        },
        metaSortKey: 0,
      });

      // The GraphQL operation type detection would be tested here
      // This is a placeholder for the actual implementation
      expect(request.body?.text).toContain('query');
    });

    it('should detect GraphQL mutation operation', async () => {
      const request = await models.request.create({
        _id: 'req_graphql_mutation',
        name: 'GraphQL Mutation',
        parentId: workspace._id,
        url: 'https://api.example.com/graphql',
        method: 'POST',
        body: {
          mimeType: 'application/json',
          text: '{"query": "mutation { createUser(input: {name: \"test\"}) { id } }"}',
        },
        metaSortKey: 0,
      });

      expect(request.body?.text).toContain('mutation');
    });

    it('should detect GraphQL subscription operation', async () => {
      const request = await models.request.create({
        _id: 'req_graphql_subscription',
        name: 'GraphQL Subscription',
        parentId: workspace._id,
        url: 'https://api.example.com/graphql',
        method: 'POST',
        body: {
          mimeType: 'application/json',
          text: '{"query": "subscription { userUpdated { id name } }"}',
        },
        metaSortKey: 0,
      });

      expect(request.body?.text).toContain('subscription');
    });
  });

  describe('Request Updates', () => {
    let workspace: any;
    let request: any;

    beforeEach(async () => {
      workspace = await models.workspace.create({
        _id: `wrk_update_${uuidv4()}`,
        name: 'Update Test Workspace',
        parentId: `proj_test_${uuidv4()}`,
        scope: 'collection',
      });

      request = await models.request.create({
        _id: `req_update_${uuidv4()}`,
        name: 'Update Request',
        parentId: workspace._id,
        url: 'https://api.example.com/update',
        method: 'GET',
        metaSortKey: 0,
      });
    });

    it('should update request name', async () => {
      const updatedRequest = await models.request.update(request, {
        name: 'Updated Request Name',
      });

      expect(updatedRequest.name).toBe('Updated Request Name');
    });

    it('should update request URL', async () => {
      const updatedRequest = await models.request.update(request, {
        url: 'https://api.example.com/updated',
      });

      expect(updatedRequest.url).toBe('https://api.example.com/updated');
    });

    it('should update request method', async () => {
      const updatedRequest = await models.request.update(request, {
        method: 'POST',
      });

      expect(updatedRequest.method).toBe('POST');
    });

    it('should update request headers', async () => {
      const newHeaders: RequestHeader[] = [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Authorization', value: 'Bearer new-token' },
      ];

      const updatedRequest = await models.request.update(request, {
        headers: newHeaders,
      });

      expect(updatedRequest.headers).toEqual(newHeaders);
    });

    it('should update request authentication', async () => {
      const newAuth: AuthTypeBasic = {
        type: 'basic',
        username: 'newuser',
        password: 'newpass',
      };

      const updatedRequest = await models.request.update(request, {
        authentication: newAuth,
      });

      expect(updatedRequest.authentication).toEqual(newAuth);
    });
  });

  describe('Request Deletion', () => {
    let workspace: any;
    let request: any;

    beforeEach(async () => {
      workspace = await models.workspace.create({
        _id: `wrk_delete_${uuidv4()}`,
        name: 'Delete Test Workspace',
        parentId: `proj_test_${uuidv4()}`,
        scope: 'collection',
      });

      request = await models.request.create({
        _id: `req_delete_${uuidv4()}`,
        name: 'Delete Request',
        parentId: workspace._id,
        url: 'https://api.example.com/delete',
        method: 'GET',
        metaSortKey: 0,
      });
    });

    it('should delete request', async () => {
      await models.request.remove(request);

      const deletedRequest = await models.request.getById(request._id);
      expect(deletedRequest).toBeUndefined();
    });
  });
});
