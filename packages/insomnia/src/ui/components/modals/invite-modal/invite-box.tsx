import { getOrganizationRoles } from 'insomnia-api';
import React, { useState } from 'react';
import { Button, Input } from 'react-aria-components';
import { useParams } from 'react-router';

import { getCurrentSessionId } from '../../../account/session';
import { AnalyticsEvent } from '../../../analytics';
import { Icon } from '../../icon';
import { startInvite } from './encryption';

/** Compact "invite by email" box that sends a member invitation to the current organization without opening the full invite dialog. */
export const InviteBox = ({
  caption = 'Just trying to share with someone? Invite them instead!',
  source,
}: {
  caption?: string;
  /** Identifies where the box is rendered; reported as `sender_role` in the invite analytics event. */
  source: string;
}) => {
  const { organizationId } = useParams() as { organizationId: string };
  const [inviteQuery, setInviteQuery] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const sendInvite = async () => {
    const email = inviteQuery.trim();
    if (!email || isInviting) {
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setIsInviting(true);
    setInviteStatus(null);
    try {
      const roles = await getOrganizationRoles({ sessionId: await getCurrentSessionId() });
      const memberRole = roles.find(role => role.name === 'member');
      if (!memberRole) {
        throw new Error('Could not find the member role.');
      }
      await startInvite({ emails: [email], teamIds: [], organizationId, roleId: memberRole.id });
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.inviteMember,
        properties: {
          numberOfInvites: 1,
          numberOfTeams: 0,
          receiver_role: memberRole.name,
          sender_role: source,
        },
      });
      setInviteQuery('');
      setInviteStatus({ type: 'success', message: `Invitation sent to ${email}.` });
    } catch (error) {
      setInviteStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to send invitation.',
      });
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <p className="text-sm text-(--hl)">{caption}</p>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Invite by email"
          placeholder="Email address"
          value={inviteQuery}
          onChange={e => setInviteQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              sendInvite();
            }
          }}
          className="flex-1 rounded-xs border border-solid border-(--hl-md) bg-(--color-bg) px-3 py-2 text-(--color-font) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
        />
        <Button
          onPress={sendInvite}
          isDisabled={isInviting || !inviteQuery.trim()}
          className="flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:bg-(--hl-xs) hover:no-underline"
        >
          <Icon icon={isInviting ? 'spinner' : 'user-plus'} className={isInviting ? 'animate-spin' : ''} /> Invite
        </Button>
      </div>
      {inviteStatus && (
        <p
          className={`text-sm ${inviteStatus.type === 'success' ? 'text-(--color-success)' : 'text-(--color-danger)'}`}
        >
          {inviteStatus.message}
        </p>
      )}
    </div>
  );
};
