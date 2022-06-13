import { HotKeyRegistry } from 'insomnia-common';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { createRequestForActiveWorkspace, CreateRequestType } from '../../../common/create-request';
import { hotKeyRefs } from '../../../common/hotkeys';
import { RequestGroup } from '../../../models/request-group';
import { selectRootState } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  handleCreateRequestGroup: (requestGroup: RequestGroup) => any;
  hotKeyRegistry: HotKeyRegistry;
  right?: boolean;
}

export const SidebarCreateDropdown: FC<Props> = ({
  handleCreateRequestGroup,
  hotKeyRegistry,
  right,
}) => {
  const rootState = useSelector(selectRootState);
  const create = useCallback((value: CreateRequestType) => {
    createRequestForActiveWorkspace(rootState)(value);
  }, [rootState]);

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
