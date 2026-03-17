// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('insomnia-api', () => ({
  generateSdkSnippet: vi.fn(),
}));

vi.mock('../../../../common/har', () => ({
  exportHarWithRequest: vi.fn(),
}));

// The following mocks are needed because importing the modal module transitively
// loads DOM-dependent code (codemirror, image assets) at module evaluation time.
vi.mock('~/ui/components/.client/codemirror/code-editor', () => ({
  CodeEditor: vi.fn(),
}));
vi.mock('~/ui/images/stainless-logo.png', () => ({ default: 'stainless-logo.png' }));

import { generateSdkSnippet } from 'insomnia-api';

import { fetchSdkSnippet } from '../generate-code-modal';

const mockSdk = { id: 'sdk-123', languages: ['typescript', 'python'] };

const baseHar = {
  url: 'https://api.example.com/users/list',
  method: 'GET',
  httpVersion: 'HTTP/1.1',
  queryString: [],
  headers: [],
  cookies: [],
  headersSize: -1,
  bodySize: -1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchSdkSnippet()', () => {
  beforeEach(() => {
    vi.mocked(generateSdkSnippet).mockResolvedValue({ code: 'snippet' });
  });

  it('passes correct arguments for a basic GET request', async () => {
    await fetchSdkSnippet(mockSdk, 'python', { ...baseHar });

    expect(generateSdkSnippet).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sdk-123',
        language: 'python',
        path: '/users/list',
        parameters: [],
        body: undefined,
      }),
    );
  });

  it('maps HAR queryString and headers to parameters', async () => {
    await fetchSdkSnippet(mockSdk, 'typescript', {
      ...baseHar,
      queryString: [{ name: 'page', value: '1' }],
      headers: [{ name: 'Authorization', value: 'Bearer token' }],
    });

    expect(generateSdkSnippet).toHaveBeenCalledWith(
      expect.objectContaining({
        parameters: expect.arrayContaining([
          { in: 'query', name: 'page', value: '1' },
          { in: 'header', name: 'Authorization', value: 'Bearer token' },
        ]),
      }),
    );
  });

  it('parses valid JSON postData into body', async () => {
    await fetchSdkSnippet(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: { text: '{"name":"Alice","age":30}', mimeType: 'application/json' },
    });

    expect(generateSdkSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ body: { name: 'Alice', age: 30 } }),
    );
  });

  it('sets body to undefined when postData is not a JSON object', async () => {
    await fetchSdkSnippet(mockSdk, 'typescript', {
      ...baseHar,
      method: 'POST',
      postData: { text: '[1,2,3]', mimeType: 'application/json' },
    });

    expect(generateSdkSnippet).toHaveBeenCalledWith(
      expect.objectContaining({ body: undefined }),
    );
  });

  it('returns the code from generateSdkSnippet', async () => {
    vi.mocked(generateSdkSnippet).mockResolvedValue({ code: 'const x = 1;' });

    const result = await fetchSdkSnippet(mockSdk, 'typescript', { ...baseHar });

    expect(result.code).toBe('const x = 1;');
  });
});
