import React, { useCallback } from 'react';
import { useFetcher, useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { CreateRequestType } from '../../hooks/use-request';
import { OrganizationLoaderData } from '../../routes/organization';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { showPrompt } from '../modals';

export const SidebarCreateDropdown = () => {
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { hotKeyRegistry } = settings;
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const create = useCallback((requestType: CreateRequestType) =>
    requestFetcher.submit({ requestType, parentId: workspaceId },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
        encType: 'application/json',
      }), [requestFetcher, organizationId, projectId, workspaceId]);

  const createGroup = useCallback(() => {
    showPrompt({
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: name => requestFetcher.submit({ parentId: workspaceId, name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
          method: 'post',
        }),
    });
  }, [requestFetcher, organizationId, projectId, workspaceId]);
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
