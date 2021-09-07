import { globalBeforeEach } from '../../../__jest__/before-each';
import getToken from '../grant-implicit';
import { createBWRedirectMock } from './helpers';
// Mock some test things
const AUTHORIZE_URL = 'https://foo.com/authorizeAuthCode';
const CLIENT_ID = 'client_123';
const REDIRECT_URI = 'https://foo.com/redirect';
const AUDIENCE = 'https://foo.com/userinfo';
const SCOPE = 'scope_123';
const STATE = 'state_123';

describe('implicit', () => {
  beforeEach(globalBeforeEach);

  it('works in default case', async () => {
    createBWRedirectMock({ redirectTo: `${REDIRECT_URI}#access_token=token_123&state=${STATE}&foo=bar` });
    const result = await getToken(AUTHORIZE_URL, CLIENT_ID, REDIRECT_URI, SCOPE, STATE, AUDIENCE);
    expect(result).toEqual({
      access_token: 'token_123',
      id_token: null,
      token_type: null,
      expires_in: null,
      scope: null,
      state: STATE,
      error: null,
      error_description: null,
      error_uri: null,
    });
  });
});
