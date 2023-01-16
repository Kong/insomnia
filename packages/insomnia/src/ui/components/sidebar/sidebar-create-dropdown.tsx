import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { createRequest, CreateRequestType } from '../../hooks/create-request';
import { createRequestGroup } from '../../hooks/create-request-group';
import { selectActiveWorkspace, selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';

export const SidebarCreateDropdown = () => {
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
  const dataTestId = 'SidebarCreateDropdown';
  return (
    <Dropdown
      aria-label='Create Dropdown'
      dataTestId={dataTestId}
      triggerButton={
        <DropdownButton
          className="btn btn--compact"
          disableHoverBehavior={false}
        >
          <i className="fa fa-plus-circle" />
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem aria-label='HTTP Request'>
        <ItemContent
          // dataTestId='CreateHttpRequest'
          icon="plus-circle"
          label="HTTP Request"
          hint={hotKeyRegistry.request_createHTTP}
          onClick={() => create('HTTP')}
        />
      </DropdownItem>

      <DropdownItem aria-label='GraphQL Request'>
        <ItemContent
          icon="plus-circle"
          label="GraphQL Request"
          onClick={() => create('GraphQL')}
        />
      </DropdownItem>

      <DropdownItem aria-label='gRPC Request'>
        <ItemContent
          icon="plus-circle"
          label="gRPC Request"
          onClick={() => create('gRPC')}
        />
      </DropdownItem>

      <DropdownItem aria-label='WebSocket Request'>
        <ItemContent
          icon="plus-circle"
          label="WebSocket Request"
          onClick={() => create('WebSocket')}
        />
      </DropdownItem>

      <DropdownItem aria-label='New Folder'>
        <ItemContent
          icon="folder"
          label="New Folder"
          hint={hotKeyRegistry.request_showCreateFolder}
          onClick={createGroup}
        />
      </DropdownItem>
    </Dropdown>
  );
};
