// @ts-nocheck
import { describe, expect, it } from 'vitest';

import {
  filterHeadersForRedirect,
  getRedirectDecision,
  isSameOrigin,
  resolveRedirectUrl,
} from './redirect-policy';

describe('isSameOrigin', () => {
  it('treats identical origins as same-origin', () => {
    expect(isSameOrigin('https://api.example.com/a', 'https://api.example.com/b')).toBe(true);
  });

  it('treats a different host as cross-origin', () => {
    expect(isSameOrigin('https://api.example.com/a', 'https://attacker.example/collect')).toBe(false);
  });

  it('treats a different port as cross-origin', () => {
    expect(isSameOrigin('https://api.example.com:443/a', 'https://api.example.com:8443/b')).toBe(false);
  });

  it('treats a different scheme as cross-origin', () => {
    expect(isSameOrigin('http://api.example.com/a', 'https://api.example.com/a')).toBe(false);
  });

  it('treats an unparseable URL as cross-origin', () => {
    expect(isSameOrigin('https://api.example.com/a', '::not-a-url::')).toBe(false);
  });
});

describe('resolveRedirectUrl', () => {
  it('resolves a relative Location against the current URL', () => {
    expect(resolveRedirectUrl('/login', 'https://api.example.com/app')).toBe('https://api.example.com/login');
  });

  it('keeps an absolute https URL', () => {
    expect(resolveRedirectUrl('https://other.example/x', 'https://api.example.com/')).toBe('https://other.example/x');
  });

  it('keeps an absolute http URL', () => {
    expect(resolveRedirectUrl('http://other.example/x', 'https://api.example.com/')).toBe('http://other.example/x');
  });

  it('rejects file URLs', () => {
    expect(resolveRedirectUrl('file:///etc/passwd', 'https://api.example.com/')).toBeNull();
  });

  it('rejects non-http schemes', () => {
    expect(resolveRedirectUrl('gopher://internal.example/1', 'https://api.example.com/')).toBeNull();
  });

  it('rejects missing or unparseable values', () => {
    expect(resolveRedirectUrl('', 'https://api.example.com/')).toBeNull();
    expect(resolveRedirectUrl('http://[::1', 'https://api.example.com/')).toBeNull();
  });
});

describe('getRedirectDecision', () => {
  it('stops on a non-redirect status', () => {
    expect(
      getRedirectDecision({ statusCode: 200, location: null, method: 'GET', currentUrl: 'https://a.example/' }),
    ).toEqual({ action: 'stop' });
  });

  it('stops on a redirect without a Location', () => {
    expect(
      getRedirectDecision({ statusCode: 302, location: null, method: 'GET', currentUrl: 'https://a.example/' }),
    ).toEqual({ action: 'stop' });
  });

  it('downgrades POST to GET on 302 and drops the body', () => {
    expect(
      getRedirectDecision({
        statusCode: 302,
        location: 'https://b.example/collect',
        method: 'POST',
        currentUrl: 'https://a.example/submit',
      }),
    ).toEqual({ action: 'follow', url: 'https://b.example/collect', method: 'GET', dropBody: true });
  });

  it('preserves POST on 307', () => {
    expect(
      getRedirectDecision({
        statusCode: 307,
        location: 'https://b.example/submit',
        method: 'POST',
        currentUrl: 'https://a.example/submit',
      }),
    ).toEqual({ action: 'follow', url: 'https://b.example/submit', method: 'POST', dropBody: false });
  });

  it('downgrades PUT to GET on 303', () => {
    expect(
      getRedirectDecision({
        statusCode: 303,
        location: 'https://b.example/done',
        method: 'PUT',
        currentUrl: 'https://a.example/item',
      }),
    ).toEqual({ action: 'follow', url: 'https://b.example/done', method: 'GET', dropBody: true });
  });

  it('keeps GET on a same-origin 301', () => {
    expect(
      getRedirectDecision({
        statusCode: 301,
        location: '/v2/things',
        method: 'GET',
        currentUrl: 'https://a.example/v1/things',
      }),
    ).toEqual({ action: 'follow', url: 'https://a.example/v2/things', method: 'GET', dropBody: true });
  });

  it('blocks a redirect to a file URL', () => {
    expect(
      getRedirectDecision({
        statusCode: 302,
        location: 'file:///etc/passwd',
        method: 'GET',
        currentUrl: 'https://a.example/',
      }),
    ).toEqual({ action: 'blocked', location: 'file:///etc/passwd' });
  });

  it('does not follow 304', () => {
    expect(
      getRedirectDecision({
        statusCode: 304,
        location: 'https://b.example/',
        method: 'GET',
        currentUrl: 'https://a.example/',
      }),
    ).toEqual({ action: 'stop' });
  });
});

describe('filterHeadersForRedirect', () => {
  const headers = [
    'Authorization: Bearer secret',
    'X-Api-Key: prod-key',
    'Accept: application/json',
    'User-Agent: custom-agent',
    'Cookie: session=abc',
    'Content-Type: application/json',
  ];

  it('forwards everything on a same-origin hop', () => {
    expect(filterHeadersForRedirect(headers, { crossOrigin: false, preserveBody: true })).toEqual({
      headers,
      stripped: [],
    });
  });

  it('drops credential and custom headers on a cross-origin hop without a body', () => {
    expect(filterHeadersForRedirect(headers, { crossOrigin: true, preserveBody: false })).toEqual({
      headers: ['Accept: application/json'],
      stripped: ['Authorization', 'X-Api-Key', 'User-Agent', 'Cookie', 'Content-Type'],
    });
  });

  it('keeps content headers on a cross-origin hop that preserves the body', () => {
    const { headers: kept, stripped } = filterHeadersForRedirect(
      ['Content-Type: application/json', 'Content-Length: 17', 'X-Api-Key: prod-key'],
      { crossOrigin: true, preserveBody: true },
    );
    expect(kept).toEqual(['Content-Type: application/json', 'Content-Length: 17']);
    expect(stripped).toEqual(['X-Api-Key']);
  });

  it('matches header names case-insensitively and parses empty-value forms', () => {
    const { headers: kept, stripped } = filterHeadersForRedirect(
      ['AUTHORIZATION: Bearer secret', 'X-Empty;', 'Accept-Encoding:'],
      { crossOrigin: true, preserveBody: false },
    );
    expect(kept).toEqual(['Accept-Encoding:']);
    expect(stripped).toEqual(['AUTHORIZATION', 'X-Empty']);
  });
});
