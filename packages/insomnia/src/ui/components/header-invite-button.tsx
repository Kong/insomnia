import { getOrgUserPermissions, type Permission } from 'insomnia-api';
import React, { useEffect, useState } from 'react';
import { Button, Heading, Link, Radio, RadioGroup } from 'react-aria-components';

import { Modal } from '~/basic-components/modal';
import { getAppWebsiteBaseURL } from '~/common/constants';
import { getCurrentSessionId } from '~/ui/account/session';
import { AnalyticsEvent } from '~/ui/analytics';
import { Tooltip } from '~/ui/components/tooltip';

import { Icon } from './icon';
import { InviteModalContainer } from './modals/invite-modal/invite-modal';

export const HeaderInviteButton = ({
  className = '',
  organizationId,
}: {
  className?: string;
  organizationId: string;
}) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [userPermission, setUserPermission] = useState<Record<Permission, boolean> | null>(null);

  // TODO: should manage this in the scope of organization context
  useEffect(() => {
    (async () => {
      getOrgUserPermissions({
        organizationId,
        sessionId: await getCurrentSessionId(),
      }).then(permissions => {
        setUserPermission(permissions);
      });
    })();
    return () => {
      setUserPermission(null);
    };
  }, [organizationId]);

  // TODO: let backend handle the license check currently
  const hasAvailableLicenses = true;
  // if backend API fails, we still allow user to invite, and let backend handle the error
  const hasPermissions =
    userPermission == null || (userPermission['create:invitation'] && userPermission['read:membership']);
  const tip = !hasAvailableLicenses ? (
    hasPermissions ? (
      <div>
        You cannot invite anyone as there are no available licenses.{' '}
        <Link href={`${getAppWebsiteBaseURL()}/app/home`} className="text-(--color-surprise)">
          You can review your usage here.
        </Link>
      </div>
    ) : (
      'You cannot invite anyone as there are no available licenses. Contact your organization’s Insomnia admins for more info.'
    )
  ) : (
    // !hasPermissions && hasAvailableLicenses: will popup 'missing someone'
    ''
  );

  const [missingOpen, setMissingOpen] = React.useState(false);

  const button = (
    <Button
      isDisabled={Boolean(tip)}
      aria-label="Invite collaborators"
      className={`${className} flex h-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm ring-1 ring-transparent transition-all focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80`}
      onPress={() => {
        if (!hasPermissions) {
          setMissingOpen(true);
          return;
        }
        setIsInviteModalOpen(true);
      }}
    >
      <Icon icon="user-plus" />
      <span className="truncate">Invite</span>
    </Button>
  );

  if (tip) {
    return (
      <Tooltip message={tip} position="bottom">
        {button}
        <InviteModalContainer
          {...{
            isOpen: isInviteModalOpen,
            setIsOpen: setIsInviteModalOpen,
          }}
        />
      </Tooltip>
    );
  }

  return (
    <>
      {button}
      <InviteModalContainer
        {...{
          isOpen: isInviteModalOpen,
          setIsOpen: setIsInviteModalOpen,
        }}
      />
      {!hasPermissions && <MissingSomeoneModal isOpen={missingOpen} onClose={() => setMissingOpen(false)} />}
    </>
  );
};

const MissingSomeoneModal = ({ isOpen, onClose }: any) => {
  const [reason, setReason] = useState<string | null>(null);
  const handleClose = () => {
    if (reason) {
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.inviteNotPermitted,
        properties: {
          collaboration_type: reason,
        },
      });
    }
    onClose?.();
  };
  return (
    <Modal title="Missing someone?" isOpen={isOpen} onClose={handleClose} isDismissable centered>
      <p className="mt-8">
        You're on a paid plan, so please contact your company's Insomnia admins to get anyone added to this account.
      </p>
      <p className="my-2 font-semibold">Just curious - why do you want to invite someone?</p>
      <RadioGroup
        name="inviteReason"
        value={reason}
        onChange={reason => {
          setReason(reason);
        }}
        className="flex flex-col gap-2"
      >
        <Radio
          value="long-term"
          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
        >
          <div className="flex items-center gap-2">
            <Heading className="text-lg font-bold">To work together in Insomnia long-term</Heading>
          </div>
        </Radio>
        <Radio
          value="one-time"
          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
        >
          <div className="flex items-center gap-2">
            <Heading className="text-lg font-bold">Just to show them something</Heading>
          </div>
        </Radio>
      </RadioGroup>
      <div className="flex justify-end">
        <Button
          className="mt-8 rounded-md bg-(--color-surprise) px-4 py-2 text-white hover:brightness-90 focus:brightness-90"
          onPress={handleClose}
        >
          Close
        </Button>
      </div>
    </Modal>
  );
};
