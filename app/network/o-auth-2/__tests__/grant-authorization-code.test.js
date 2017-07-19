import getToken from '../grant-authorization-code';
import {createBWRedirectMock} from './helpers';

// Mock some test things
const AUTHORIZE_URL = 'https://foo.com/authorizeAuthCode';
const ACCESS_TOKEN_URL = 'https://foo.com/access_token';
const CLIENT_ID = 'client_123';
const CLIENT_SECRET = 'secret_12345456677756343';
const REDIRECT_URI = 'https://foo.com/redirect';
const SCOPE = 'scope_123';
const STATE = 'state_123';

describe('authorization_code', () => {
  beforeEach(global.insomniaBeforeEach);
  it('gets token with JSON and basic auth', async () => {
    createBWRedirectMock(`${REDIRECT_URI}?code=code_123&state=${STATE}`);
    window.fetch = jest.fn(() => new window.Response(
      JSON.stringify({access_token: 'token_123', token_type: 'token_type', scope: SCOPE}),
      {headers: {'Content-Type': 'application/json'}}
    ));

    const result = await getToken(
      AUTHORIZE_URL,
      ACCESS_TOKEN_URL,
      false,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
      SCOPE,
      STATE
    );

    // Check the request to fetch the token
    expect(window.fetch.mock.calls).toEqual([[ACCESS_TOKEN_URL, {
      body: [
        'grant_type=authorization_code',
        'code=code_123',
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
        `state=${STATE}`
      ].join('&'),
      method: 'POST',
      headers: {
        'Accept': 'application/x-www-form-urlencoded, application/json',
        'Authorization': 'Basic Y2xpZW50XzEyMzpzZWNyZXRfMTIzNDU0NTY2Nzc3NTYzNDM=',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }]]);

    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      refresh_token: null,
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });

  it('gets token with urlencoded and body auth', async () => {
    createBWRedirectMock(`${REDIRECT_URI}?code=code_123&state=${STATE}`);
    window.fetch = jest.fn(() => new window.Response(
      `access_token=token_123&token_type=token_type&scope=${SCOPE}`,
      {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ));

    const result = await getToken(
      AUTHORIZE_URL,
      ACCESS_TOKEN_URL,
      true,
      CLIENT_ID,
      CLIENT_SECRET,
      REDIRECT_URI,
      SCOPE,
      STATE
    );

    // Check the request to fetch the token
    expect(window.fetch.mock.calls).toEqual([[ACCESS_TOKEN_URL, {
      body: [
        'grant_type=authorization_code',
        'code=code_123',
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
        `state=${STATE}`,
        `client_id=${CLIENT_ID}`,
        `client_secret=${CLIENT_SECRET}`
      ].join('&'),
      method: 'POST',
      headers: {
        'Accept': 'application/x-www-form-urlencoded, application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }]]);

    // Check the expected value
    expect(result).toEqual({
      access_token: 'token_123',
      refresh_token: null,
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });
});
