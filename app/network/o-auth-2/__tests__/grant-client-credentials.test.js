import getToken from '../grant-client-credentials';
import {globalBeforeEach} from '../../../__jest__/before-each';
import * as network from '../../network';

// Mock some test things
const ACCESS_TOKEN_URL = 'https://foo.com/access_token';
const CLIENT_ID = 'client_123';
const CLIENT_SECRET = 'secret_12345456677756343';
const SCOPE = 'scope_123';

describe('client_credentials', () => {
  beforeEach(globalBeforeEach);
  it('gets token with JSON and basic auth', async () => {
    network.sendWithSettings = jest.fn(() => ({
      bodyBuffer: Buffer.from(JSON.stringify({
        access_token: 'token_123',
        token_type: 'token_type',
        scope: SCOPE
      })),
      response: {
        statusCode: 200,
        headers: [{name: 'Content-Type', value: 'application/json'}]
      }
    }));

    const result = await getToken(
      'req_1',
      ACCESS_TOKEN_URL,
      false,
      CLIENT_ID,
      CLIENT_SECRET,
      SCOPE
    );

    // Check the request to fetch the token
    expect(network.sendWithSettings.mock.calls).toEqual([['req_1', {
      url: ACCESS_TOKEN_URL,
      method: 'POST',
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          {name: 'grant_type', value: 'client_credentials', disabled: false},
          {name: 'scope', value: SCOPE, disabled: false}
        ]
      },
      headers: [
        {name: 'Content-Type', value: 'application/x-www-form-urlencoded'},
        {name: 'Accept', value: 'application/x-www-form-urlencoded, application/json'},
        {name: 'Authorization', value: 'Basic Y2xpZW50XzEyMzpzZWNyZXRfMTIzNDU0NTY2Nzc3NTYzNDM='}
      ]
    }]]);

    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });

  it('gets token with urlencoded and body auth', async () => {
    network.sendWithSettings = jest.fn(() => ({
      bodyBuffer: Buffer.from(JSON.stringify({
        access_token: 'token_123',
        token_type: 'token_type',
        scope: SCOPE
      })),
      response: {
        statusCode: 200,
        headers: [{name: 'Content-Type', value: 'application/x-www-form-urlencoded'}]
      }
    }));

    const result = await getToken(
      'req_1',
      ACCESS_TOKEN_URL,
      true,
      CLIENT_ID,
      CLIENT_SECRET,
      SCOPE
    );

    // Check the request to fetch the token
    expect(network.sendWithSettings.mock.calls).toEqual([['req_1', {
      url: ACCESS_TOKEN_URL,
      method: 'POST',
      body: {
        mimeType: 'application/x-www-form-urlencoded',
        params: [
          {name: 'grant_type', value: 'client_credentials', disabled: false},
          {name: 'scope', value: SCOPE, disabled: false},
          {name: 'client_id', value: CLIENT_ID, disabled: false},
          {name: 'client_secret', value: CLIENT_SECRET, disabled: false}
        ]
      },
      headers: [
        {name: 'Content-Type', value: 'application/x-www-form-urlencoded'},
        {name: 'Accept', value: 'application/x-www-form-urlencoded, application/json'}
      ]
    }]]);

    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });
});
