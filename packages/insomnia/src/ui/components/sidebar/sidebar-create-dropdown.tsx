import React, { FC } from 'react';
import { useSelector } from 'react-redux';
import { useFetcher, useParams } from 'react-router-dom';

import { CreateRequestType } from '../../hooks/create-request';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showModal, showPrompt } from '../modals';
import { ProtoFilesModal } from '../modals/proto-files-modal';

interface Props {
  right?: boolean;
}

export const SidebarCreateDropdown: FC<Props> = ({ right }) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const createRequestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const create = (requestType: CreateRequestType) => {
    if (requestType === 'gRPC') {
      showModal(ProtoFilesModal, {
        onSave: async (protoFileId: string) => {
          createRequestFetcher.submit({ requestType, protoFileId },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
              method: 'post',
            });
        },
      });
      return;
    }
    createRequestFetcher.submit({ requestType },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      });
  };

  const dataTestId = 'SidebarCreateDropdown';
  return (
    <Dropdown right={right} dataTestId={dataTestId}>
      <DropdownButton className="btn btn--compact">
        <i className="fa fa-plus-circle" />
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem dataTestId='CreateHttpRequest' onClick={() => create('HTTP')}>
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

      <DropdownItem
        onClick={() => {
          showPrompt({
            title: 'New Folder',
            defaultValue: 'My Folder',
            submitName: 'Create',
            label: 'Name',
            selectText: true,
            onComplete: async name => {
              createRequestFetcher.submit({ name },
                {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-folder`,
                  method: 'post',
                });
            },
          });
        }}
      >
        <i className="fa fa-folder" />New Folder
        <DropdownHint keyBindings={hotKeyRegistry.request_showCreateFolder} />
      </DropdownItem>
    </Dropdown>
  );
};
