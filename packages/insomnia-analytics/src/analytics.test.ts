import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrack = vi.fn();
const mockPage = vi.fn();
const mockCloseAndFlush = vi.fn().mockResolvedValue(void 0);

vi.mock('@segment/analytics-node', () => ({
  Analytics: vi.fn(() => ({
    track: mockTrack,
    page: mockPage,
    closeAndFlush: mockCloseAndFlush,
  })),
}));

describe('InsomniaAnalytics', () => {
  beforeEach(() => {
    vi.resetModules();
    mockTrack.mockReset();
    mockPage.mockReset();
    mockCloseAndFlush.mockReset().mockResolvedValue(void 0);
  });

  it('forwards track calls with platform-tagged properties and an app+os context', async () => {
    const { InsomniaAnalytics } = await import('./analytics');
    const analytics = new InsomniaAnalytics({
      writeKey: 'test',
      app: { appName: 'inso', appVersion: '1.2.3', osVersion: '14.0', platform: 'cli' },
    });

    analytics.track({ event: 'inso_run_test', properties: { suite: 'echo' }, anonymousId: 'anon-1' });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    const [payload] = mockTrack.mock.calls[0];
    expect(payload).toMatchObject({
      event: 'inso_run_test',
      anonymousId: 'anon-1',
      userId: '',
      properties: { suite: 'echo', platform: 'cli' },
      context: { app: { name: 'inso', version: '1.2.3' }, os: { version: '14.0' } },
    });
  });

  it('resolves osVersion lazily when provided as a function', async () => {
    const { InsomniaAnalytics } = await import('./analytics');
    let v = '1.0';
    const analytics = new InsomniaAnalytics({
      writeKey: 'test',
      app: { appName: 'app', appVersion: '0.1', osVersion: () => v, platform: 'app' },
    });

    v = '2.0';
    analytics.track({ event: 'App Started', anonymousId: 'a', userId: 'u' });

    const [payload] = mockTrack.mock.calls[0];
    expect(payload.context.os.version).toBe('2.0');
  });

  it('routes analytics errors through the onError handler', async () => {
    const onError = vi.fn();
    const { InsomniaAnalytics } = await import('./analytics');
    const analytics = new InsomniaAnalytics({
      writeKey: 'test',
      app: { appName: 'app', appVersion: '0.1', osVersion: '1.0', platform: 'app' },
      onError,
    });

    analytics.track({ event: 'App Started', anonymousId: 'a' });
    const [, callback] = mockTrack.mock.calls[0];
    callback(new Error('segment failure'));

    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
