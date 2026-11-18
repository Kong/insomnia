/**
 * @vitest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteBox } from './invite-box';

const { getOrgUserPermissions, getOrganizationRoles, useParams } = vi.hoisted(() => ({
  getOrgUserPermissions: vi.fn(),
  getOrganizationRoles: vi.fn(),
  useParams: vi.fn(),
}));

vi.mock('insomnia-api', () => ({ getOrgUserPermissions, getOrganizationRoles }));
vi.mock('react-router', () => ({ useParams }));
vi.mock('../../../account/session', () => ({ getCurrentSessionId: vi.fn().mockResolvedValue('session-id') }));
vi.mock('./encryption', () => ({ startInvite: vi.fn() }));
vi.mock('../../icon', () => ({ Icon: () => null }));

// Harness follows use-global-curl-paste-import.test.tsx: manual createRoot + act.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('InviteBox', () => {
  let container: HTMLDivElement;
  let root: Root;

  const renderBox = async () => {
    await act(async () => {
      root.render(<InviteBox source="test" />);
    });
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders nothing for the scratchpad organization without fetching permissions', async () => {
    useParams.mockReturnValue({ organizationId: 'org_scratchpad' });
    await renderBox();
    expect(container.innerHTML).toBe('');
    expect(getOrgUserPermissions).not.toHaveBeenCalled();
  });

  it('renders nothing for a Konnect organization', async () => {
    useParams.mockReturnValue({ organizationId: 'org_konnect_acct' });
    await renderBox();
    expect(container.innerHTML).toBe('');
    expect(getOrgUserPermissions).not.toHaveBeenCalled();
  });

  it('renders when the user has invite and membership permissions', async () => {
    useParams.mockReturnValue({ organizationId: 'org_1' });
    getOrgUserPermissions.mockResolvedValue({ 'create:invitation': true, 'read:membership': true });
    await renderBox();
    expect(getOrgUserPermissions).toHaveBeenCalledWith({ organizationId: 'org_1', sessionId: 'session-id' });
    expect(container.querySelector('input[aria-label="Invite by email"]')).not.toBeNull();
  });

  it.each([
    { 'create:invitation': false, 'read:membership': true },
    { 'create:invitation': true, 'read:membership': false },
  ])('hides the box when permissions are missing: %o', async permissions => {
    useParams.mockReturnValue({ organizationId: 'org_1' });
    getOrgUserPermissions.mockResolvedValue(permissions);
    await renderBox();
    expect(container.innerHTML).toBe('');
  });

  it('still renders when the permissions request fails', async () => {
    useParams.mockReturnValue({ organizationId: 'org_1' });
    getOrgUserPermissions.mockRejectedValue(new Error('network'));
    await renderBox();
    expect(container.querySelector('input[aria-label="Invite by email"]')).not.toBeNull();
  });
});
