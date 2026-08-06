// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockTrackUserAction, mockGetCurrentSessionId, mockGetAccountId } = vi.hoisted(() => ({
  mockTrackUserAction: vi.fn(),
  mockGetCurrentSessionId: vi.fn(),
  mockGetAccountId: vi.fn(),
}));

vi.mock('insomnia-api', () => ({
  trackUserAction: mockTrackUserAction,
}));

vi.mock('~/common/account/session', () => ({
  getCurrentSessionId: mockGetCurrentSessionId,
  getAccountId: mockGetAccountId,
}));

vi.mock('uuid', () => ({
  v4: () => 'evt_123',
}));

import { trackUserActivity } from './track-user-activity';

describe('trackUserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('no-ops when there is no session', async () => {
    mockGetCurrentSessionId.mockResolvedValue(null);

    await trackUserActivity('request_created');

    expect(mockTrackUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when there is no account id', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue(null);

    await trackUserActivity('request_created');

    expect(mockTrackUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when the current user is not on an enterprise plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'individual' }));

    await trackUserActivity('request_created');

    expect(mockTrackUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when there is no cached plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');

    await trackUserActivity('request_created');

    expect(mockTrackUserAction).not.toHaveBeenCalled();
  });

  it('tracks the action for an enterprise plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise' }));

    await trackUserActivity('request_created');

    expect(mockTrackUserAction).toHaveBeenCalledWith({
      sessionId: 'sess_xyz',
      eventId: 'evt_123',
      actionType: 'request_created',
    });
  });

  it('tracks the action for an enterprise-member plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise-member' }));

    await trackUserActivity('request_executed');

    expect(mockTrackUserAction).toHaveBeenCalledWith({
      sessionId: 'sess_xyz',
      eventId: 'evt_123',
      actionType: 'request_executed',
    });
  });

  it('does not throw when trackUserAction rejects', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise' }));
    mockTrackUserAction.mockRejectedValue(new Error('network error'));

    await expect(trackUserActivity('document_created')).resolves.toBeUndefined();
  });
});
