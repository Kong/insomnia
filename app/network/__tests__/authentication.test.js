import {getAuthHeader} from '../authentication';
import {AUTH_OAUTH_1} from '../../common/constants';

describe('OAuth 1.0', () => {
  it('Does OAuth 1.0', async () => {
    const header = await getAuthHeader(
      'req_123',
      'https://insomnia.rest/',
      'GET',
      {
        type: AUTH_OAUTH_1,
        consumerKey: 'consumerKey',
        consumerSecret: 'consumerSecret',
        callback: 'https://insomnia.rest/callback/',
        tokenKey: 'tokenKey',
        tokenSecret: 'tokenSecret',
        signatureMethod: 'HMAC-SHA1',
        nonce: 'nonce',
        timestamp: '1234567890'
      }
    );

    expect(header).toEqual({
      name: 'Authorization',
      value: [
        'OAuth ' +
        'oauth_callback="https%3A%2F%2Finsomnia.rest%2Fcallback%2F"',
        'oauth_consumer_key="consumerKey"',
        'oauth_nonce="nonce"',
        'oauth_signature="muJumAG6rOEUuJmhx5zOcBquqk8%3D"',
        'oauth_signature_method="HMAC-SHA1"',
        'oauth_timestamp="1234567890"',
        'oauth_token="tokenKey"',
        'oauth_version="1.0"'
      ].join(', ')
    });
  });

  it('Does OAuth 1.0 with defaults', async () => {
    const header = await getAuthHeader(
      'req_123',
      'https://insomnia.rest/',
      'GET',
      {
        type: AUTH_OAUTH_1,
        consumerKey: 'consumerKey',
        consumerSecret: 'consumerSecret',
        signatureMethod: 'HMAC-SHA1'
      }
    );

    expect(header.name).toBe('Authorization');
    expect(header.value).toMatch(new RegExp([
      'OAuth ' +
      'oauth_consumer_key="consumerKey"',
      'oauth_nonce="[\\w\\d]*"',
      'oauth_signature="[\\w\\d%]*"',
      'oauth_signature_method="HMAC-SHA1"',
      'oauth_timestamp="\\d*"',
      'oauth_version="1\\.0"'
    ].join(', ')));
  });
});
