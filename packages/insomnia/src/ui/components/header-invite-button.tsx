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
        className={`${className} flex h-full items-center justify-center gap-2 rounded-md px-4 py-2 text-sm ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80`}
        onPress={() => setIsInviteModalOpen(true)}
      >
        <Icon icon="user-plus" />
        <span className="truncate">Invite</span>
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
