import fs from 'fs';
import path from 'path';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { getTempDir } from '../../../common/electron-helpers';
import * as network from '../../network';
import getToken from '../grant-authorization-code';
import { createBWRedirectMock } from './helpers';

// Mock some test things
const AUTHORIZE_URL = 'https://foo.com/authorizeAuthCode';
const ACCESS_TOKEN_URL = 'https://foo.com/access_token';
const CLIENT_ID = 'client_123';
const CLIENT_SECRET = 'secret_12345456677756343';
const REDIRECT_URI = 'https://foo.com/redirect';
const SCOPE = 'scope_123';
const STATE = 'state_123';
const AUDIENCE = 'https://foo.com/resource';
const RESOURCE = 'foo.com';

describe('authorization_code', () => {
  beforeEach(globalBeforeEach);

  it('gets token with JSON and basic auth', async () => {
    createBWRedirectMock({ redirectTo: `${REDIRECT_URI}?code=code_123&state=${STATE}` });
    const bodyPath = path.join(getTempDir(), 'foo.response');
    fs.writeFileSync(
      bodyPath,
      JSON.stringify({
        access_token: 'token_123',
        token_type: 'token_type',
        scope: SCOPE,
        audience: AUDIENCE,
        resource: RESOURCE,
      }),
    );
    network.sendWithSettings = jest.fn(() => ({
      bodyPath,
      bodyCompression: '',
      parentId: 'req_1',
      statusCode: 200,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/json',
        },
      ],
    }));
    const result = await getToken(
      'req_1',
      AUTHORIZE_URL,
      ACCESS_TOKEN_URL,
      false,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
      SCOPE,
      STATE,
      AUDIENCE,
      RESOURCE,
    );
    // Check the request to fetch the token
    expect(network.sendWithSettings.mock.calls).toEqual([
      [
        'req_1',
        {
          url: ACCESS_TOKEN_URL,
          method: 'POST',
          body: {
            mimeType: 'application/x-www-form-urlencoded',
            params: [
              {
                name: 'grant_type',
                value: 'authorization_code',
              },
              {
                name: 'code',
                value: 'code_123',
              },
              {
                name: 'redirect_uri',
                value: REDIRECT_URI,
              },
              {
                name: 'state',
                value: STATE,
              },
              {
                name: 'audience',
                value: AUDIENCE,
              },
              {
                name: 'resource',
                value: RESOURCE,
              },
            ],
          },
          headers: [
            {
              name: 'Content-Type',
              value: 'application/x-www-form-urlencoded',
            },
            {
              name: 'Accept',
              value: 'application/x-www-form-urlencoded, application/json',
            },
            {
              name: 'Authorization',
              value: 'Basic Y2xpZW50XzEyMzpzZWNyZXRfMTIzNDU0NTY2Nzc3NTYzNDM=',
            },
          ],
        },
      ],
    ]);
    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      id_token: null,
      refresh_token: null,
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      audience: AUDIENCE,
      resource: RESOURCE,
      error: null,
      error_uri: null,
      error_description: null,
      xResponseId: expect.stringMatching(/^res_/),
    });
  });

  it('gets token with urlencoded and body auth', async () => {
    createBWRedirectMock({ redirectTo:  `${REDIRECT_URI}?code=code_123&state=${STATE}` });
    const bodyPath = path.join(getTempDir(), 'foo.response');
    fs.writeFileSync(
      bodyPath,
      JSON.stringify({
        access_token: 'token_123',
        token_type: 'token_type',
        scope: SCOPE,
        audience: AUDIENCE,
        resource: RESOURCE,
      }),
    );
    network.sendWithSettings = jest.fn(() => ({
      bodyPath,
      bodyCompression: '',
      parentId: 'req_1',
      statusCode: 200,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/x-www-form-urlencoded',
        },
      ],
    }));
    const result = await getToken(
      'req_1',
      AUTHORIZE_URL,
      ACCESS_TOKEN_URL,
      true,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
      SCOPE,
      STATE,
      AUDIENCE,
      RESOURCE,
    );
    // Check the request to fetch the token
    expect(network.sendWithSettings.mock.calls).toEqual([
      [
        'req_1',
        {
          url: ACCESS_TOKEN_URL,
          method: 'POST',
          body: {
            mimeType: 'application/x-www-form-urlencoded',
            params: [
              {
                name: 'grant_type',
                value: 'authorization_code',
              },
              {
                name: 'code',
                value: 'code_123',
              },
              {
                name: 'redirect_uri',
                value: REDIRECT_URI,
              },
              {
                name: 'state',
                value: STATE,
              },
              {
                name: 'audience',
                value: AUDIENCE,
              },
              {
                name: 'resource',
                value: RESOURCE,
              },
              {
                name: 'client_id',
                value: CLIENT_ID,
              },
              {
                name: 'client_secret',
                value: CLIENT_SECRET,
              },
            ],
          },
          headers: [
            {
              name: 'Content-Type',
              value: 'application/x-www-form-urlencoded',
            },
            {
              name: 'Accept',
              value: 'application/x-www-form-urlencoded, application/json',
            },
          ],
        },
      ],
    ]);
    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      id_token: null,
      refresh_token: null,
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      audience: AUDIENCE,
      resource: RESOURCE,
      error: null,
      error_uri: null,
      error_description: null,
      xResponseId: expect.stringMatching(/^res_/),
    });
  });

  it('uses PKCE', async () => {
    createBWRedirectMock({ redirectTo: `${REDIRECT_URI}?code=code_123&state=${STATE}` });
    const bodyPath = path.join(getTempDir(), 'foo.response');
    fs.writeFileSync(
      bodyPath,
      JSON.stringify({
        access_token: 'token_123',
        token_type: 'token_type',
        scope: SCOPE,
        audience: AUDIENCE,
        resource: RESOURCE,
      }),
    );
    network.sendWithSettings = jest.fn(() => ({
      bodyPath,
      bodyCompression: '',
      parentId: 'req_1',
      statusCode: 200,
      headers: [
        {
          name: 'Content-Type',
          value: 'application/json',
        },
      ],
    }));
    const result = await getToken(
      'req_1',
      AUTHORIZE_URL,
      ACCESS_TOKEN_URL,
      false,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
      SCOPE,
      STATE,
      AUDIENCE,
      RESOURCE,
      true,
    );
    // Check the request to fetch the token
    expect(network.sendWithSettings.mock.calls[0][1].body.params).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'code_verifier',
        }),
      ]),
    );
    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      id_token: null,
      refresh_token: null,
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      audience: AUDIENCE,
      resource: RESOURCE,
      error: null,
      error_uri: null,
      error_description: null,
      xResponseId: expect.stringMatching(/^res_/),
    });
  });
});
