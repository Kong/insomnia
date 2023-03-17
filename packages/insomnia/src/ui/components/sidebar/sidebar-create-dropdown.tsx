import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useFetcher, useParams } from 'react-router-dom';

import { CreateRequestType } from '../../hooks/create-request';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { showPrompt } from '../modals';

export const SidebarCreateDropdown = () => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const createRequestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const create = useCallback((value: CreateRequestType) =>
    createRequestFetcher.submit({ requestType:value, parentId: workspaceId  },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      }), [createRequestFetcher, organizationId, projectId, workspaceId]);

  const createGroup = useCallback(() => {
    showPrompt({
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: name => createRequestFetcher.submit({ parentId: workspaceId, name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
          method: 'post',
        }),
    });
  }, [createRequestFetcher, organizationId, projectId, workspaceId]);
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
