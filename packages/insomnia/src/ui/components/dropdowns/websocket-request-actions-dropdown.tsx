import React, { useCallback } from 'react';
import { useSelector } from 'react-redux';

import { toKebabCase } from '../../../common/misc';
import * as requestOperations from '../../../models/helpers/request-operations';
import { incrementDeletedRequests } from '../../../models/stats';
import { WebSocketRequest } from '../../../models/websocket-request';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { selectHotKeyRegistry } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown/dropdown';
import { PromptButton } from '../base/prompt-button';
import { showPrompt } from '../modals';

interface Props {
  handleDuplicateRequest: Function;
  isPinned: Boolean;
  request: WebSocketRequest;
  handleShowSettings: () => void;
}

export const WebSocketRequestActionsDropdown = ({
  handleDuplicateRequest,
  isPinned,
  handleShowSettings,
  request,
}: Props) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);

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
      onComplete: name => {
        requestOperations.update(request, { name });
      },
    });
  }, [request]);

  const togglePin = useCallback(() => {
    updateRequestMetaByParentId(request._id, { pinned: !isPinned });
  }, [isPinned, request]);

  const deleteRequest = useCallback(() => {
    incrementDeletedRequests();
    requestOperations.remove(request);
  }, [request]);

  return (
    <Dropdown
      dataTestId={`Dropdown-${toKebabCase(request.name)}`}
      triggerButton={
        <DropdownButton variant='text' style={{ padding: 0, borderRadius: 'unset' }}>
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem>
        <ItemContent icon="copy" label="Duplicate" hint={hotKeyRegistry.request_showDuplicate} onClick={duplicate} />
      </DropdownItem>
      <DropdownItem>
        <ItemContent icon="thumb-tack" label={isPinned ? 'Unpin' : 'Pin'} hint={hotKeyRegistry.request_togglePin} onClick={togglePin} />
      </DropdownItem>
      <DropdownItem>
        <ItemContent icon="edit" label="Rename" onClick={handleRename} />
      </DropdownItem>
      <DropdownItem>
        <PromptButton fullWidth onClick={deleteRequest}>
          <ItemContent icon="trash-o" label="Delete" hint={hotKeyRegistry.request_showDelete} />
        </PromptButton>
      </DropdownItem>
      <DropdownSection>
        <DropdownItem> {/* dataTestId={`DropdownItemSettings-${toKebabCase(request.name)}`} */}
          <ItemContent icon="wrench" label="Settings" hint={hotKeyRegistry.request_showSettings} onClick={handleShowSettings} />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};

WebSocketRequestActionsDropdown.displayName = 'WebSocketRequestActionsDropdown';
