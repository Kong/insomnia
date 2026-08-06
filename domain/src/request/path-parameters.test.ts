import { describe, expect, it } from 'vitest';

import { getPathParametersFromUrl } from './path-parameters';

describe('getPathParametersFromUrl', () => {
  it('returns an empty array when the URL has no path parameters', () => {
    expect(getPathParametersFromUrl('https://example.com/users')).toEqual([]);
  });

  it('extracts path parameters from colon-prefixed segments', () => {
    expect(getPathParametersFromUrl('https://example.com/users/:id/posts/:postId')).toEqual(['id', 'postId']);
  });

  it('deduplicates repeated path parameters', () => {
    expect(getPathParametersFromUrl('https://example.com/:id/vs/:id')).toEqual(['id']);
  });

  it('stops a segment at query strings, fragments, and further colons', () => {
    expect(getPathParametersFromUrl('https://example.com/:id?foo=:bar#frag')).toEqual(['id']);
  });
});
