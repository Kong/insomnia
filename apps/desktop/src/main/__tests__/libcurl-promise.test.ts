import { describe, expect, it } from 'vitest';

import { shouldBypassProxyForHost } from '~/main/network/libcurl-promise';

describe('shouldBypassProxyForHost()', () => {
  it('returns false when there is no noProxy setting', () => {
    expect(shouldBypassProxyForHost('rest.rodeo', '')).toBe(false);
  });

  it('returns false when there is no hostname', () => {
    expect(shouldBypassProxyForHost(null, '.rest.rodeo')).toBe(false);
  });

  it('matches an exact hostname without a leading dot', () => {
    expect(shouldBypassProxyForHost('rest.rodeo', 'rest.rodeo')).toBe(true);
  });

  it('does not match a subdomain when the entry has no leading dot', () => {
    expect(shouldBypassProxyForHost('api.rest.rodeo', 'rest.rodeo')).toBe(false);
  });

  it('matches the bare domain when the entry has a leading dot', () => {
    expect(shouldBypassProxyForHost('rest.rodeo', '.rest.rodeo')).toBe(true);
  });

  it('matches any subdomain when the entry has a leading dot', () => {
    expect(shouldBypassProxyForHost('api.rest.rodeo', '.rest.rodeo')).toBe(true);
  });

  it('does not match an unrelated domain that shares a suffix', () => {
    expect(shouldBypassProxyForHost('notrest.rodeo', '.rest.rodeo')).toBe(false);
  });

  it('honors every entry in a comma-separated list, not just the first', () => {
    const noProxy = '.rest.rodeo,.konghq.com,localhost';
    expect(shouldBypassProxyForHost('rest.rodeo', noProxy)).toBe(true);
    expect(shouldBypassProxyForHost('api.rest.rodeo', noProxy)).toBe(true);
    expect(shouldBypassProxyForHost('konghq.com', noProxy)).toBe(true);
    expect(shouldBypassProxyForHost('api.konghq.com', noProxy)).toBe(true);
  });

  it('trims whitespace around entries', () => {
    expect(shouldBypassProxyForHost('api.rest.rodeo', ' .rest.rodeo , .konghq.com ')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(shouldBypassProxyForHost('API.REST.RODEO', '.rest.rodeo')).toBe(true);
  });

  it('returns false for a host that does not match any entry', () => {
    expect(shouldBypassProxyForHost('example.com', '.rest.rodeo,.konghq.com')).toBe(false);
  });
});
