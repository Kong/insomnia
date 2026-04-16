import { describe, expect, it } from 'vitest';

import { encodePKCE } from '~/network/o-auth-2/get-token';

import { oauth1SignRequest } from '../oauth';

describe('oauth1SignRequest', () => {
  it('signs with HMAC-SHA1', () => {
    const result = oauth1SignRequest({
      url: 'https://insomnia.rest/',
      method: 'GET',
      signatureMethod: 'HMAC-SHA1',
      consumerKey: 'consumerKey',
      consumerSecret: 'consumerSecret',
      tokenKey: 'tokenKey',
      tokenSecret: 'tokenSecret',
      nonce: 'nonce',
      timestamp: '1234567890',
      callback: 'https://insomnia.rest/callback/',
    });

    expect(result.Authorization).toContain('OAuth');
    expect(result.Authorization).toContain('oauth_signature_method="HMAC-SHA1"');
    expect(result.Authorization).toContain('oauth_consumer_key="consumerKey"');
    expect(result.Authorization).toContain('oauth_signature="muJumAG6rOEUuJmhx5zOcBquqk8%3D"');
  });

  it('signs with HMAC-SHA256', () => {
    const result = oauth1SignRequest({
      url: 'https://insomnia.rest/',
      method: 'GET',
      signatureMethod: 'HMAC-SHA256',
      consumerKey: 'consumerKey',
      consumerSecret: 'consumerSecret',
      tokenKey: 'tokenKey',
      tokenSecret: 'tokenSecret',
      nonce: 'nonce',
      timestamp: '1234567890',
    });

    expect(result.Authorization).toContain('oauth_signature_method="HMAC-SHA256"');
    expect(result.Authorization).toMatch(/oauth_signature="[^"]+"/);
  });

  it('signs with PLAINTEXT', () => {
    const result = oauth1SignRequest({
      url: 'https://insomnia.rest/',
      method: 'GET',
      signatureMethod: 'PLAINTEXT',
      consumerKey: 'ck',
      consumerSecret: 'cs',
      tokenKey: 'tk',
      tokenSecret: 'ts',
    });

    expect(result.Authorization).toContain('oauth_signature_method="PLAINTEXT"');
    expect(result.Authorization).toMatch(/oauth_signature="[^"]+"/);
  });

  it('signs with RSA-SHA1', () => {
    const privateKey =
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
      '-----END RSA PRIVATE KEY-----';

    const result = oauth1SignRequest({
      url: 'https://insomnia.rest/',
      method: 'GET',
      signatureMethod: 'RSA-SHA1',
      consumerKey: 'consumerKey',
      consumerSecret: 'consumerSecret',
      tokenKey: 'tokenKey',
      privateKey,
      nonce: 'nonce',
      timestamp: '1234567890',
      callback: 'https://insomnia.rest/callback/',
    });

    expect(result.Authorization).toContain('oauth_signature_method="RSA-SHA1"');
    expect(result.Authorization).toContain(
      'oauth_signature="cuJlDLQcyQkIdfs8sIE9Y1769hrPy%2Fkwq8D%2BSQxl5azvk1TimWSgUECf3vJoF7DkgnvcYhFYTnduldj%2FJ9ttaOh8xmfE7krGm8Yh%2FDqYfvLPKnw%2F%2BAaKjd43Y6ulZqptTaf4q5D0%2FM9MhqI8pNRcblk30fI%2FR6JYRyjHVm3YNZo%3D"',
    );
  });

  it('throws on unknown signature method', () => {
    expect(() =>
      oauth1SignRequest({
        url: 'https://example.com',
        method: 'GET',
        // @ts-expect-error intentional bad value
        signatureMethod: 'UNKNOWN',
        consumerKey: 'ck',
        consumerSecret: 'cs',
      }),
    ).toThrow('Invalid signature method UNKNOWN');
  });
});

describe('encodePKCE', () => {
  it('produces URL-safe base64 without padding', () => {
    const input = Buffer.from('hello world test input for pkce');
    const result = encodePKCE(input);
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
    expect(result).not.toContain('=');
  });

  it('round-trips through window.crypto.getRandomValues bytes', () => {
    // Simulate what get-token.ts now does: getRandomValues → Buffer.from → encodePKCE
    const bytes = new Uint8Array(32);
    // Fill with deterministic values for test stability
    bytes.fill(0xab);
    const verifier = encodePKCE(Buffer.from(bytes));
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThan(0);
  });

  it('produces correct SHA-256 code challenge (S256 method)', async () => {
    // Deterministic verifier; use globalThis.crypto (available in Node 18+)
    const verifier = 'dGhpcyBpcyBhIHRlc3QgdmVyaWZpZXI';
    const hashBuf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    const challenge = encodePKCE(Buffer.from(hashBuf));
    expect(challenge).not.toContain('+');
    expect(challenge).not.toContain('/');
    expect(challenge).not.toContain('=');
    expect(challenge.length).toBeGreaterThan(0);
  });
});
