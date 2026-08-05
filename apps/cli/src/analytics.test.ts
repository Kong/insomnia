import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockTrack = vi.fn();

vi.mock('@segment/analytics-node', () => ({
  Analytics: vi.fn(() => ({
    track: mockTrack,
    closeAndFlush: vi.fn(),
  })),
}));

vi.mock('./db/adapters/ne-db-adapter', () => ({
  default: vi.fn().mockResolvedValue(null),
}));

describe('analytics', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    mockTrack.mockClear();
  });

  it('should use the same anonymousId for multiple trackInsoEvent calls', async () => {
    const { trackInsoEvent, InsoEvent } = await import('./analytics');

    await trackInsoEvent(InsoEvent.lintSpec);
    await trackInsoEvent(InsoEvent.exportSpec);

    expect(mockTrack).toHaveBeenCalledTimes(2);

    const firstCallAnonymousId = mockTrack.mock.calls[0][0].anonymousId;
    const secondCallAnonymousId = mockTrack.mock.calls[1][0].anonymousId;

    expect(firstCallAnonymousId).toBe(secondCallAnonymousId);
    expect(firstCallAnonymousId).toMatch(/^anon_/);
  });
});
