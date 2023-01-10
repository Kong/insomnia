import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { createRequest, CreateRequestType } from '../../hooks/create-request';
import { createRequestGroup } from '../../hooks/create-request-group';
import { selectActiveWorkspace, selectHotKeyRegistry } from '../../redux/selectors';
import { Button } from '../base/dropdown-aria/button';
import { Dropdown, DropdownItem, ItemContent } from '../base/dropdown-aria/dropdown';

export const SidebarCreateDropdown: FC = () => {
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
      dataTestId={dataTestId}
      triggerButton={
        <Button className="btn btn--compact">
          <i className="fa fa-plus-circle" />
          <i className="fa fa-caret-down" />
        </Button>
      }
    >
      <DropdownItem> {/* dataTestId='CreateHttpRequest' */}
        <ItemContent icon="plus-circle" label="HTTP Request" hint={hotKeyRegistry.request_createHTTP} onClick={() => create('HTTP')} />
      </DropdownItem>

      <DropdownItem>
        <ItemContent icon="plus-circle" label="GraphQL Request" onClick={() => create('GraphQL')} />
      </DropdownItem>

      <DropdownItem>
        <ItemContent icon="plus-circle" label="gRPC Request" onClick={() => create('gRPC')} />
      </DropdownItem>

      <DropdownItem>
        <ItemContent icon="plus-circle" label="WebSocket Request" onClick={() => create('WebSocket')} />
      </DropdownItem>

      <DropdownItem>
        <ItemContent icon="circle" label="New Folder" hint={hotKeyRegistry.request_showCreateFolder} onClick={createGroup} />
      </DropdownItem>
    </Dropdown>
  );
};
