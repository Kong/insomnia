import { describe, expect, it } from 'vitest';

import { parseDeepLinkUrl, resolveImportDeepLink, sanitizeUrlAndExtractOrigin } from '../import-deep-link';

describe('parseDeepLinkUrl', () => {
  it('splits path from decoded params', () => {
    const parsed = parseDeepLinkUrl('insomnia://app/import?mcp=' + encodeURIComponent('https://example.com/mcp?v=2'));
    expect(parsed).toEqual({
      urlWithoutParams: 'insomnia://app/import',
      params: { mcp: 'https://example.com/mcp?v=2' },
    });
  });

  it('returns null for unparseable input', () => {
    expect(parseDeepLinkUrl('not-a-url')).toBeNull();
  });

  it('normalizes insomniadev:// only in development', () => {
    expect(parseDeepLinkUrl('insomniadev://app/import', true)?.urlWithoutParams).toBe('insomnia://app/import');
    expect(parseDeepLinkUrl('insomniadev://app/import', false)?.urlWithoutParams).toBe('insomniadev://app/import');
  });
});

describe('sanitizeUrlAndExtractOrigin', () => {
  it('returns the origin or an empty string', () => {
    expect(sanitizeUrlAndExtractOrigin('https://app.insomnia.rest/run/?mcp=x')).toBe('https://app.insomnia.rest');
    expect(sanitizeUrlAndExtractOrigin()).toBe('');
    expect(sanitizeUrlAndExtractOrigin('not a url')).toBe('');
  });
});

describe('resolveImportDeepLink', () => {
  it('dispatches uri with endpoint/operationId', () => {
    expect(resolveImportDeepLink({ uri: 'https://example.com/openapi.yaml', endpoint: 'GET,/pets', operationId: 'listPets' })).toEqual({
      type: 'uri',
      defaultValue: 'https://example.com/openapi.yaml',
      origin: '',
      endpoint: 'GET,/pets',
      operationId: 'listPets',
    });
  });

  it('dispatches mcp without endpoint/operationId', () => {
    expect(resolveImportDeepLink({ mcp: 'https://example.com/mcp', endpoint: 'GET,/pets' })).toEqual({
      type: 'mcp',
      defaultValue: 'https://example.com/mcp',
      origin: '',
    });
  });

  it('prefers uri over mcp over curl and trims values', () => {
    expect(resolveImportDeepLink({ uri: ' https://x/spec.yaml ', mcp: 'https://x/mcp' })?.defaultValue).toBe('https://x/spec.yaml');
    expect(resolveImportDeepLink({ mcp: 'https://x/mcp', curl: 'curl https://x' })?.type).toBe('mcp');
  });

  it('returns null when no resource param is present', () => {
    expect(resolveImportDeepLink({ origin: 'https://app.insomnia.rest' })).toBeNull();
    expect(resolveImportDeepLink({ mcp: '   ' })).toBeNull();
  });
});
