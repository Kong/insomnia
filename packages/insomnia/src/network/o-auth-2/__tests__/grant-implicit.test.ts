import { beforeEach, describe, expect, it } from '@jest/globals';

import { globalBeforeEach } from '../../../__jest__/before-each';
import { grantImplicit } from '../grant-implicit';

const REDIRECT_URI = 'https://foo.com/redirect';
const STATE = 'state_123';

describe('implicit', () => {
  beforeEach(globalBeforeEach);

  it('works in default case', async () => {
    window.main = { authorizeUserInWindow: () => Promise.resolve(`${REDIRECT_URI}#access_token=token_123&state=${STATE}&foo=bar`) };

    const result = await grantImplicit('', '');
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
