import { HotKeyRegistry } from 'insomnia-common';
import React, { FC, useCallback } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { RequestGroup } from '../../../models/request-group';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  handleCreateRequest: (id: string) => any;
  handleCreateRequestGroup: (requestGroup: RequestGroup) => any;
  hotKeyRegistry: HotKeyRegistry;
  right?: boolean;
}

export const SidebarCreateDropdown: FC<Props> = ({
  handleCreateRequest,
  handleCreateRequestGroup,
  hotKeyRegistry,
  right,
}) => {
  const create = useCallback((value: string) => {
    handleCreateRequest(value);
  }, [handleCreateRequest]);

  return (
    <Dropdown right={right}>
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-plus-circle" />
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem value="HTTP" onClick={create}>
        <i className="fa fa-plus-circle" />HTTP Request
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_CREATE_HTTP.id]} />
      </DropdownItem>

      <DropdownItem value="GraphQL" onClick={create}>
        <i className="fa fa-plus-circle" />GraphQL Request
      </DropdownItem>

      <DropdownItem value="gRPC" onClick={create}>
        <i className="fa fa-plus-circle" />gRPC Request
      </DropdownItem>

      <DropdownItem onClick={handleCreateRequestGroup}>
        <i className="fa fa-folder" />New Folder
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]} />
      </DropdownItem>
    </Dropdown>
  );
};
