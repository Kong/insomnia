// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRecordUserAction, mockGetCurrentSessionId, mockGetAccountId } = vi.hoisted(() => ({
  mockRecordUserAction: vi.fn(),
  mockGetCurrentSessionId: vi.fn(),
  mockGetAccountId: vi.fn(),
}));

vi.mock('insomnia-api', () => ({
  recordUserAction: mockRecordUserAction,
}));

vi.mock('~/common/account/session', () => ({
  getCurrentSessionId: mockGetCurrentSessionId,
  getAccountId: mockGetAccountId,
}));

vi.mock('uuid', () => ({
  v4: () => 'evt_123',
}));

import { recordAction } from './record-action';

describe('recordAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('no-ops when there is no session', async () => {
    mockGetCurrentSessionId.mockResolvedValue(null);

    await recordAction('request_created');

    expect(mockRecordUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when there is no account id', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue(null);

    await recordAction('request_created');

    expect(mockRecordUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when the current user is not on an enterprise plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'individual' }));

    await recordAction('request_created');

    expect(mockRecordUserAction).not.toHaveBeenCalled();
  });

  it('no-ops when there is no cached plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');

    await recordAction('request_created');

    expect(mockRecordUserAction).not.toHaveBeenCalled();
  });

  it('tracks the action for an enterprise plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise' }));

    await recordAction('request_created');

    expect(mockRecordUserAction).toHaveBeenCalledWith({
      sessionId: 'sess_xyz',
      eventId: 'evt_123',
      actionType: 'request_created',
    });
  });

  it('tracks the action for an enterprise-member plan', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise-member' }));

    await recordAction('request_executed');

    expect(mockRecordUserAction).toHaveBeenCalledWith({
      sessionId: 'sess_xyz',
      eventId: 'evt_123',
      actionType: 'request_executed',
    });
  });

  it('does not throw when recordUserAction rejects', async () => {
    mockGetCurrentSessionId.mockResolvedValue('sess_xyz');
    mockGetAccountId.mockResolvedValue('acct_123');
    localStorage.setItem('acct_123:currentPlan', JSON.stringify({ type: 'enterprise' }));
    mockRecordUserAction.mockRejectedValue(new Error('network error'));

    await expect(recordAction('document_created')).resolves.toBeUndefined();
  });
});
