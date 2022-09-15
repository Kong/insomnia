import React, { FC, useCallback, useRef } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { KeydownBinder } from '../keydown-binder';
import { showAuthenticationModal } from '../modals/authentication-modal';
import { showCookiesModal } from '../modals/cookies-modal';

export const ManageDropdown: FC = () => {
  const dropdownRef = useRef<DropdownHandle>(null);

  const onKeydown = useCallback((event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.PREFERENCES_WORKSPACE, () => {
      dropdownRef.current?.toggle(true);
    });
  }, []);

  return (
    <KeydownBinder onKeydown={onKeydown}>
      <Dropdown ref={dropdownRef}>
        <DropdownButton className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            <div className="sidebar__menu__thing__text">
              Manage
            </div>

            <i className="space-left fa fa-caret-down" />
          </div>

        </DropdownButton>

        <DropdownItem value={null} onClick={showCookiesModal}>
          Cookies
        </DropdownItem>

        <DropdownItem value={null} onClick={showAuthenticationModal}>
          Authentication
        </DropdownItem>
      </Dropdown>
    </KeydownBinder>
  );
};
