import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPlugins = vi.hoisted(() => ({
  hasRequestHooks: vi.fn(),
  hasResponseHooks: vi.fn(),
  applyRequestHooks: vi.fn(),
  applyResponseHooks: vi.fn(),
}));

Object.defineProperty(globalThis, 'window', {
  value: { main: { plugins: mockPlugins } },
  writable: true,
  configurable: true,
});

import { applyRequestHooks, applyResponseHooks } from '../network-adapter.renderer';

const makeRequest = (extra: Record<string, any> = {}) =>
  ({
    url: 'http://example.com',
    headers: [],
    settingSendCookies: true,
    settingStoreCookies: true,
    ...extra,
  }) as any;

const mockRenderedContext = {
  getProjectId: () => 'test-project',
} as any;

const mockResponse = {
  url: 'http://example.com',
  status: 200,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockPlugins.hasRequestHooks.mockResolvedValue(false);
  mockPlugins.hasResponseHooks.mockResolvedValue(false);
  mockPlugins.applyRequestHooks.mockResolvedValue(makeRequest());
  mockPlugins.applyResponseHooks.mockResolvedValue(mockResponse);
});

describe('applyRequestHooks', () => {
  it('skips applyRequestHooks when hasRequestHooks returns false', async () => {
    await applyRequestHooks(makeRequest(), mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).not.toHaveBeenCalled();
  });

  it('calls applyRequestHooks when hasRequestHooks returns true', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    await applyRequestHooks(makeRequest(), mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).toHaveBeenCalledOnce();
  });

  it('passes projectId and environment to applyRequestHooks', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    await applyRequestHooks(makeRequest(), mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'test-project' }));
  });

  it('propagates errors from applyRequestHooks', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    mockPlugins.applyRequestHooks.mockRejectedValue(new Error('[plugin=test-plugin] sync failure'));
    await expect(applyRequestHooks(makeRequest(), mockRenderedContext)).rejects.toThrow('sync failure');
  });

  it('applies DEFAULT_HEADERS from the environment without invoking the plugin window', async () => {
    const ctx = { ...mockRenderedContext, DEFAULT_HEADERS: { 'X-Custom': 'value' } };
    const result = await applyRequestHooks(makeRequest(), ctx);
    expect(result.headers).toEqual(expect.arrayContaining([{ name: 'X-Custom', value: 'value' }]));
    expect(mockPlugins.applyRequestHooks).not.toHaveBeenCalled();
  });

  it('skips DEFAULT_HEADERS that already exist on the request', async () => {
    const ctx = { ...mockRenderedContext, DEFAULT_HEADERS: { 'X-Custom': 'value' } };
    const result = await applyRequestHooks(makeRequest({ headers: [{ name: 'X-Custom', value: 'existing' }] }), ctx);
    const matches = result.headers.filter((h: any) => h.name === 'X-Custom');
    expect(matches).toHaveLength(1);
    expect(matches[0].value).toBe('existing');
  });

  it('does not add a DEFAULT_HEADER whose value is "null"', async () => {
    const ctx = { ...mockRenderedContext, DEFAULT_HEADERS: { 'X-Remove': 'null' } };
    const result = await applyRequestHooks(makeRequest(), ctx);
    expect(result.headers.find((h: any) => h.name === 'X-Remove')).toBeUndefined();
  });
});

describe('applyResponseHooks', () => {
  it('returns the original response when hasResponseHooks returns false', async () => {
    const result = await applyResponseHooks(mockResponse, makeRequest(), mockRenderedContext);
    expect(result).toBe(mockResponse);
    expect(mockPlugins.applyResponseHooks).not.toHaveBeenCalled();
  });

  it('calls applyResponseHooks when hasResponseHooks returns true', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    await applyResponseHooks(mockResponse, makeRequest(), mockRenderedContext);
    expect(mockPlugins.applyResponseHooks).toHaveBeenCalledOnce();
  });

  // The adapter propagates; network.ts:responseTransform catches and converts to an error ResponsePatch.
  it('propagates errors from the plugin window to the caller', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue(new Error('[plugin=test-plugin] hook exploded'));
    await expect(applyResponseHooks(mockResponse, makeRequest(), mockRenderedContext)).rejects.toThrow('hook exploded');
  });

  it('returns the modified response on success', async () => {
    const modified = { ...mockResponse, status: 201 };
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockResolvedValue(modified);
    const result = await applyResponseHooks(mockResponse, makeRequest(), mockRenderedContext);
    expect(result).toBe(modified);
  });
});
