import getToken from '../grant-client-credentials';

// Mock some test things
const ACCESS_TOKEN_URL = 'https://foo.com/access_token';
const CLIENT_ID = 'client_123';
const CLIENT_SECRET = 'secret_12345456677756343';
const SCOPE = 'scope_123';

describe('client_credentials', () => {
  beforeEach(global.insomniaBeforeEach);
  it('gets token with JSON and basic auth', async () => {
    window.fetch = jest.fn(() => new window.Response(
      JSON.stringify({access_token: 'token_123', token_type: 'token_type', scope: SCOPE}),
      {headers: {'Content-Type': 'application/json'}}
    ));

    const result = await getToken(
      ACCESS_TOKEN_URL,
      false,
      CLIENT_ID,
      CLIENT_SECRET,
      SCOPE
    );

    // Check the request to fetch the token
    expect(window.fetch.mock.calls).toEqual([[ACCESS_TOKEN_URL, {
      body: [
        'grant_type=client_credentials',
        `scope=${SCOPE}`
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
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });

  it('gets token with urlencoded and body auth', async () => {
    window.fetch = jest.fn(() => new window.Response(
      `access_token=token_123&token_type=token_type&scope=${SCOPE}`,
      {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ));

    const result = await getToken(
      ACCESS_TOKEN_URL,
      true,
      CLIENT_ID,
      CLIENT_SECRET,
      SCOPE
    );

    // Check the request to fetch the token
    expect(window.fetch.mock.calls).toEqual([[ACCESS_TOKEN_URL, {
      body: [
        'grant_type=client_credentials',
        `scope=${SCOPE}`,
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
      expires_in: null,
      token_type: 'token_type',
      scope: SCOPE,
      error: null,
      error_uri: null,
      error_description: null
    });
  });
});
