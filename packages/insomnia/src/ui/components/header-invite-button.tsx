import React, { useState } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from './icon';
import { InviteModalContainer } from './modals/invite-modal/invite-modal';

export const HeaderInviteButton = ({ className = '' }) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  return (
    <>
      <Button
        aria-label="Invite collaborators"
        className={`${className} px-4 py-2 h-full flex items-center justify-center gap-2 aria-pressed:opacity-80 rounded-md hover:bg-opacity-80 focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm`}
        onPress={() => setIsInviteModalOpen(true)}
      >
        <Icon icon="user-plus" />
        <span className="truncate">
          Invite
        </span>
      </Button>
      <InviteModalContainer
        {...{
          isOpen: isInviteModalOpen,
          setIsOpen: setIsInviteModalOpen,
        }}
      />
    </>
  );
};
