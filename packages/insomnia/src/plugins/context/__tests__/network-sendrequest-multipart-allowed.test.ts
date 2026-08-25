import { describe, expect, it, vi } from 'vitest';

// Confirms the legacy (default, useQuickJsScriptSandbox: false) sendRequestWithoutSideEffects
// implementation is untouched by the QuickJS-sandbox-specific fix in
// quickjs-script-engine.ts's assertSupportedSendRequestBody (see
// templating-worker-database-sendrequest-multipart-filepath-scoping.test.ts, which proves the same
// multipart body is denied when reached through the QuickJS bridge). This implementation runs with
// an already-privileged execution model (a real Electron BrowserWindow, or a direct Node/Inso
// import) rather than through the sandboxed `insomnia-templating-worker-database://` protocol
// handler, so its behavior toward a multipart body is intentionally left as-is here.

vi.mock('insomnia-data', () => ({
  services: {
    settings: { get: vi.fn().mockResolvedValue({ followRedirects: false }) },
    helpers: { readCurlResponse: vi.fn().mockResolvedValue({ body: '{}' }) },
  },
}));
vi.mock('../../../main/network/libcurl-promise', () => ({ curlRequest: vi.fn() }));

import * as plugin from '../network';

describe('network.sendRequestWithoutSideEffects (legacy, non-QuickJS execution context)', () => {
  it('still forwards a multipart body\'s file parts to curlRequest unchanged', async () => {
    const { curlRequest: curlRequestMock } = await import('../../../main/network/libcurl-promise');
    (curlRequestMock as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      headerResults: [{ code: 200, reason: 'OK', headers: [] }],
      patch: { elapsedTime: 1, bodyCompression: null },
      responseBodyPath: '/dev/null',
    });

    const outsideAllowedFoldersPath = '/Users/someone/not-a-real-file.txt';
    const { network } = plugin.init();

    await network.sendRequestWithoutSideEffects({
      request: {
        url: 'https://example.com',
        method: 'POST',
        headers: [],
        body: {
          mimeType: 'multipart/form-data',
          params: [{ name: 'f', type: 'file', fileName: outsideAllowedFoldersPath }],
        },
      },
    } as any);

    expect(curlRequestMock).toHaveBeenCalledTimes(1);
    const forwardedParams = (curlRequestMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]?.req?.body
      ?.params;
    expect(forwardedParams).toContainEqual(expect.objectContaining({ fileName: outsideAllowedFoldersPath }));
  });
});
