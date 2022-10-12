import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { createRequest, CreateRequestType } from '../../hooks/create-request';
import { createRequestGroup } from '../../hooks/create-request-group';
import { selectActiveWorkspace, selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  right?: boolean;
}

export const SidebarCreateDropdown: FC<Props> = ({ right }) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceId = activeWorkspace?._id;
  const create = useCallback((value: CreateRequestType) => {
    if (activeWorkspaceId) {
      createRequest({
        requestType: value,
        parentId: activeWorkspaceId,
        workspaceId: activeWorkspaceId,
      });
    }
  }, [activeWorkspaceId]);

  const createGroup = useCallback(() => {
    if (!activeWorkspaceId) {
      return;
    }

    createRequestGroup(activeWorkspaceId);
  }, [activeWorkspaceId]);

  return (
    <Dropdown right={right}>
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-plus-circle" />
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={() => create('HTTP')}>
        <i className="fa fa-plus-circle" />HTTP Request
        <DropdownHint keyBindings={hotKeyRegistry.request_createHTTP} />
      </DropdownItem>

      <DropdownItem onClick={() => create('GraphQL')}>
        <i className="fa fa-plus-circle" />GraphQL Request
      </DropdownItem>

      <DropdownItem onClick={() => create('gRPC')}>
        <i className="fa fa-plus-circle" />gRPC Request
      </DropdownItem>

      <DropdownItem onClick={() => create('WebSocket')}>
        <i className="fa fa-plus-circle" />WebSocket Request
      </DropdownItem>

      <DropdownItem onClick={createGroup}>
        <i className="fa fa-folder" />New Folder
        <DropdownHint keyBindings={hotKeyRegistry.request_showCreateFolder} />
      </DropdownItem>
    </Dropdown>
  );
};
