import React, { forwardRef, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useFetcher, useParams } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { incrementDeletedRequests } from '../../../models/stats';
import { WebSocketRequest } from '../../../models/websocket-request';
import { useRequestMetaPatcher, useRequestPatcher } from '../../hooks/use-request';
import { OrganizationLoaderData } from '../../routes/organization';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, type DropdownProps, DropdownSection, ItemContent } from '../base/dropdown';
import { showPrompt } from '../modals';
interface Props extends Omit<DropdownProps, 'children' > {
  handleDuplicateRequest: Function;
  isPinned: Boolean;
  request: WebSocketRequest;
  handleShowSettings: () => void;
}

export const WebSocketRequestActionsDropdown = forwardRef<DropdownHandle, Props>(({
  handleDuplicateRequest,
  isPinned,
  handleShowSettings,
  request,
}, ref) => {
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const patchRequestMeta = useRequestMetaPatcher();
  const { hotKeyRegistry } = settings;
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const patchRequest = useRequestPatcher();
  const duplicate = useCallback(() => {
    handleDuplicateRequest(request);
  }, [handleDuplicateRequest, request]);

  const handleRename = useCallback(() => {
    showPrompt({
      title: 'Rename Request',
      defaultValue: request.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => patchRequest(request._id, { name }),
    });
  }, [request.name, request._id, patchRequest]);

  const togglePin = useCallback(() => {
    patchRequestMeta(request._id, { pinned: !isPinned });
  }, [isPinned, request._id, patchRequestMeta]);

  const deleteRequest = useCallback(() => {
    incrementDeletedRequests();
    requestFetcher.submit({ id: request._id },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete`,
        method: 'post',
      });
  }, [requestFetcher, organizationId, projectId, request._id, workspaceId]);

  return (
    <Dropdown
      ref={ref}
      aria-label="Websocket Request Actions Dropdown"
      dataTestId={`Dropdown-${toKebabCase(request.name)}`}
      triggerButton={
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem aria-label='Duplicate'>
        <ItemContent
          icon="copy"
          label="Duplicate"
          hint={hotKeyRegistry.request_showDuplicate}
          onClick={duplicate}
        />
      </DropdownItem>
      <DropdownItem aria-label={isPinned ? 'Unpin' : 'Pin'}>
        <ItemContent
          icon="thumb-tack"
          label={isPinned ? 'Unpin' : 'Pin'}
          hint={hotKeyRegistry.request_togglePin}
          onClick={togglePin}
        />
      </DropdownItem>
      <DropdownItem aria-label='Rename'>
        <ItemContent
          icon="edit"
          label="Rename"
          onClick={handleRename}
        />
      </DropdownItem>
      <DropdownItem aria-label='Delete'>
        <ItemContent
          icon="trash-o"
          label="Delete"
          hint={hotKeyRegistry.request_showDelete}
          withPrompt
          onClick={deleteRequest}
        />
      </DropdownItem>
      <DropdownSection aria-label='Settings section'>
        <DropdownItem aria-label='Settings'>
          <ItemContent
            icon="wrench"
            label="Settings"
            hint={hotKeyRegistry.request_showSettings}
            onClick={handleShowSettings}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});

WebSocketRequestActionsDropdown.displayName = 'WebSocketRequestActionsDropdown';
