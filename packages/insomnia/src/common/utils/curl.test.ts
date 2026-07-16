import { describe, expect, it } from 'vitest';

import { isCurlCommand } from './curl';

describe('isCurlCommand', () => {
  it('matches a bare curl command', () => {
    expect(isCurlCommand('curl https://example.com')).toBe(true);
  });

  it('matches curl with no arguments', () => {
    expect(isCurlCommand('curl')).toBe(true);
  });

  it('matches curl prefixed with a shell prompt', () => {
    expect(isCurlCommand('$ curl https://example.com')).toBe(true);
  });

  it('matches curl with leading/trailing whitespace', () => {
    expect(isCurlCommand('  curl https://example.com  ')).toBe(true);
  });

  it('matches curl regardless of case', () => {
    expect(isCurlCommand('CURL https://example.com')).toBe(true);
    expect(isCurlCommand('CuRl https://example.com')).toBe(true);
  });

  it('matches curl followed by flags', () => {
    expect(isCurlCommand('curl -X POST https://example.com')).toBe(true);
  });

  it('does not match a URL that merely starts with "curl"', () => {
    expect(isCurlCommand('curl.se/docs')).toBe(false);
  });

  it('does not match "curl" as part of a longer word', () => {
    expect(isCurlCommand('curling https://example.com')).toBe(false);
  });

  it('does not match when curl is not the first token', () => {
    expect(isCurlCommand('echo curl https://example.com')).toBe(false);
  });

  it('does not match unrelated text', () => {
    expect(isCurlCommand('https://example.com')).toBe(false);
    expect(isCurlCommand('')).toBe(false);
  });
});
