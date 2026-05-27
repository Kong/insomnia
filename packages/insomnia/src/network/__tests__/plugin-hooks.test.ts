import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequestCtx = vi.hoisted(() => ({
  getEnvironmentVariable: vi.fn().mockReturnValue(null),
  hasHeader: vi.fn().mockReturnValue(false),
  removeHeader: vi.fn(),
  setHeader: vi.fn(),
}));

const mockPlugins = vi.hoisted(() => ({
  hasRequestHooks: vi.fn(),
  hasResponseHooks: vi.fn(),
  applyRequestHooks: vi.fn(),
  applyResponseHooks: vi.fn(),
}));

vi.mock('../../plugins/context/request', () => ({
  init: vi.fn().mockReturnValue({ request: mockRequestCtx }),
}));

Object.defineProperty(globalThis, 'window', {
  value: { main: { plugins: mockPlugins } },
  writable: true,
  configurable: true,
});

import { _applyRequestPluginHooks, _applyResponsePluginHooks } from '../network';

const mockRenderedRequest = {
  url: 'http://example.com',
  headers: [],
  settingSendCookies: true,
  settingStoreCookies: true,
} as any;

const mockRenderedContext = {
  getProjectId: () => 'test-project',
} as any;

const mockResponse = {
  url: 'http://example.com',
  status: 200,
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequestCtx.getEnvironmentVariable.mockReturnValue(null);
  mockPlugins.hasRequestHooks.mockResolvedValue(false);
  mockPlugins.hasResponseHooks.mockResolvedValue(false);
  mockPlugins.applyRequestHooks.mockResolvedValue(mockRenderedRequest);
  mockPlugins.applyResponseHooks.mockResolvedValue(mockResponse);
});

describe('_applyRequestPluginHooks', () => {
  it('skips applyRequestHooks when hasRequestHooks returns false', async () => {
    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).not.toHaveBeenCalled();
  });

  it('calls applyRequestHooks when hasRequestHooks returns true', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).toHaveBeenCalledOnce();
  });

  it('passes projectId and environment to applyRequestHooks', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);
    expect(mockPlugins.applyRequestHooks).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'test-project' }),
    );
  });

  it('propagates errors from applyRequestHooks', async () => {
    mockPlugins.hasRequestHooks.mockResolvedValue(true);
    mockPlugins.applyRequestHooks.mockRejectedValue(new Error('[plugin=test-plugin] sync failure'));
    await expect(_applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext)).rejects.toThrow('sync failure');
  });

  it('applies DEFAULT_HEADERS from the environment without invoking the plugin window', async () => {
    mockRequestCtx.getEnvironmentVariable.mockReturnValue({ 'X-Custom': 'value' });
    mockRequestCtx.hasHeader.mockReturnValue(false);

    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);

    expect(mockRequestCtx.setHeader).toHaveBeenCalledWith('X-Custom', 'value');
    expect(mockPlugins.applyRequestHooks).not.toHaveBeenCalled();
  });

  it('skips DEFAULT_HEADERS that already exist on the request', async () => {
    mockRequestCtx.getEnvironmentVariable.mockReturnValue({ 'X-Custom': 'value' });
    mockRequestCtx.hasHeader.mockReturnValue(true);

    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);

    expect(mockRequestCtx.setHeader).not.toHaveBeenCalled();
  });

  it('removes a DEFAULT_HEADER when its value is "null"', async () => {
    mockRequestCtx.getEnvironmentVariable.mockReturnValue({ 'X-Remove': 'null' });
    mockRequestCtx.hasHeader.mockReturnValue(false);

    await _applyRequestPluginHooks(mockRenderedRequest, mockRenderedContext);

    expect(mockRequestCtx.removeHeader).toHaveBeenCalledWith('X-Remove');
  });
});

describe('_applyResponsePluginHooks', () => {
  it('returns the original response when hasResponseHooks returns false', async () => {
    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);
    expect(result).toBe(mockResponse);
    expect(mockPlugins.applyResponseHooks).not.toHaveBeenCalled();
  });

  it('calls applyResponseHooks when hasResponseHooks returns true', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);
    expect(mockPlugins.applyResponseHooks).toHaveBeenCalledOnce();
  });

  it('returns an error ResponsePatch instead of throwing on hook failure', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue(new Error('[plugin=test-plugin] hook exploded'));

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result).toHaveProperty('error');
    expect(result.statusMessage).toBe('Error');
  });

  it('includes the error message in the error response', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue(new Error('[plugin=test-plugin] detailed failure reason'));

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);
    expect(result.error).toContain('detailed failure reason');
  });

  it('handles non-Error rejections without producing undefined in the error message', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue('string rejection');

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);
    expect(result.error).toContain('string rejection');
    expect(result.error).not.toContain('undefined');
  });

  it('returns an error ResponsePatch for async hook rejections', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue(new Error('[plugin=test-plugin] async boom'));

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('async boom');
  });

  it('preserves the request URL in the error response', async () => {
    mockPlugins.hasResponseHooks.mockResolvedValue(true);
    mockPlugins.applyResponseHooks.mockRejectedValue(new Error('[plugin=test-plugin] fail'));

    const result = await _applyResponsePluginHooks(mockResponse, mockRenderedRequest, mockRenderedContext);
    expect(result.url).toBe('http://example.com');
  });
});
