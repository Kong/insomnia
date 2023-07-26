import React, { useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { createRequest, CreateRequestType } from '../../hooks/create-request';
import { createRequestGroup } from '../../hooks/create-request-group';
import { RootLoaderData } from '../../routes/root';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
export const SidebarCreateDropdown = () => {
  const {
    settings,
  } = useRouteLoaderData('root') as RootLoaderData;
  const { hotKeyRegistry } = settings;
  const {
    activeWorkspace,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const create = useCallback((value: CreateRequestType) => {
    if (activeWorkspace._id) {
      createRequest({
        requestType: value,
        parentId: activeWorkspace._id,
        workspaceId: activeWorkspace._id,
      });
    }
  }, [activeWorkspace._id]);

  const createGroup = useCallback(() => {
    if (!activeWorkspace._id) {
      return;
    }

    createRequestGroup(activeWorkspace._id);
  }, [activeWorkspace._id]);
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
          icon="plus-circle"
          label="HTTP Request"
          hint={hotKeyRegistry.request_createHTTP}
          onClick={() => create('HTTP')}
        />
      </DropdownItem>

      <DropdownItem aria-label='Event Stream Request'>
        <ItemContent
          icon="plus-circle"
          label="Event Stream Request"
          onClick={() => create('Event Stream')}
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
