import { getAuthHeader } from '../authentication';
import { AUTH_OAUTH_1 } from '../../common/constants';

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
        'OAuth ' + 'oauth_callback="https%3A%2F%2Finsomnia.rest%2Fcallback%2F"',
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

  it('Does OAuth 1.0 with RSA-SHA1', async () => {
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
        signatureMethod: 'RSA-SHA1',
        privateKey:
          '-----BEGIN RSA PRIVATE KEY-----\n' +
          'MIICXgIBAAKBgQC6jwJjt/KywX4N4ZA3YOLcNFrS9S2+TcArdMyo89yqLZWzC9x9\n' +
          'MY4gA+1+iOpG+S/jlDM3WuJSCnEzQhzDo9UGtNODC+Qr8nStRcKdjSOhywRXPd4d\n' +
          '+u6TOae/Flukwqzl0Pw3fsMWqwp0dni6OIc7E2gm2jj4MTLsd4oq/0igCQIDAQAB\n' +
          'AoGBAJCdHusRwo6SsxYrjdF/xxuPcgApkmX8e0S0a5lkP9+jKnH6ddaOPW/P25/E\n' +
          'nmaZ72dokDMOvnV+JrXnP8jgDNatJsBqS2aLBNpSI4TsOQDfhB3rPoafc5s2bNVY\n' +
          '5SRp2kr3QL74BZzLzAsIJzGDpRyKQGRPzMFiPzkQcfJuO7rpAkEA3gZq2v2OUzcV\n' +
          'iQIoCy7bkvxaKZUlkj6xT0msExqrAt9mtVE6XW3GsHUSyB2ePOzDz6zcKeX90nTq\n' +
          '79PAGTAm1wJBANcbO+xt9By9Omq8K51RuKkvlESHH8j+meAWW6DoKJvHdy2/+xnA\n' +
          'XEcDcWb9cV9V5FNWmJ+mMF1jfu/GxTMp9B8CQQDazaQ80KiUZbK5ZQCllLYbcspA\n' +
          'NJXkPBhtNQN5iEyD9jm38qb8MBUhDR9HS7kH/aUzYv1N5TRxVXu6ggnMSOHdAkBI\n' +
          'Gojrp6+8MnHydUDpawtLKve4QNMWvME3rEbqmOeD0EjSvReeeix0YWMR8sKeAlyW\n' +
          '0uA2I67ynvddyHMxw05hAkEAyXuG1xpqs3VYQeHRC67dQjkKw0YbcOeeWHpo1+cn\n' +
          'F29dI2yG3Ti+28/WlSdfYGe9P9SfeYM7RQbNbUp1MHWrkg==\n' +
          '-----END RSA PRIVATE KEY-----',
        nonce: 'nonce',
        timestamp: '1234567890'
      }
    );

    expect(header).toEqual({
      name: 'Authorization',
      value: [
        'OAuth ' + 'oauth_callback="https%3A%2F%2Finsomnia.rest%2Fcallback%2F"',
        'oauth_consumer_key="consumerKey"',
        'oauth_nonce="nonce"',
        'oauth_signature="cuJlDLQcyQkIdfs8sIE9Y1769hrPy%2Fkwq8D%2BSQxl5azvk1TimWSgUECf3vJoF7DkgnvcYhFYTnduldj%2FJ9ttaOh8xmfE7krGm8Yh%2FDqYfvLPKnw%2F%2BAaKjd43Y6ulZqptTaf4q5D0%2FM9MhqI8pNRcblk30fI%2FR6JYRyjHVm3YNZo%3D"',
        'oauth_signature_method="RSA-SHA1"',
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
    expect(header.value).toMatch(
      new RegExp(
        [
          'OAuth ' + 'oauth_consumer_key="consumerKey"',
          'oauth_nonce="[\\w\\d]*"',
          'oauth_signature="[\\w\\d%]*"',
          'oauth_signature_method="HMAC-SHA1"',
          'oauth_timestamp="\\d*"',
          'oauth_version="1\\.0"'
        ].join(', ')
      )
    );
  });
});
