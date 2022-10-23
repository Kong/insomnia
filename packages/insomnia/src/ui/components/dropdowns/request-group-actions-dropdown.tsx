import classnames from 'classnames';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import * as requestOperations from '../../../models/helpers/request-operations';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { createRequest, CreateRequestType } from '../../hooks/create-request';
import { createRequestGroup } from '../../hooks/create-request-group';
import { selectActiveEnvironment, selectActiveProject, selectActiveWorkspace, selectHotKeyRegistry } from '../../redux/selectors';
import { type DropdownHandle, type DropdownProps, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { showError, showModal, showPrompt } from '../modals';
import { EnvironmentEditModal } from '../modals/environment-edit-modal';

interface Props extends Partial<DropdownProps> {
  requestGroup: RequestGroup;
  handleShowSettings: (requestGroup: RequestGroup) => any;
}

export interface RequestGroupActionsDropdownHandle {
    show: () => void;
}

export const RequestGroupActionsDropdown = forwardRef<RequestGroupActionsDropdownHandle, Props>(({
  requestGroup,
  handleShowSettings,
  ...other
}, ref) => {
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const [actionPlugins, setActionPlugins] = useState<RequestGroupAction[]>([]);
  const [loadingActions, setLoadingActions] = useState< Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const activeProject = useSelector(selectActiveProject);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceId = activeWorkspace?._id;

  const create = useCallback((requestType: CreateRequestType) => {
    if (activeWorkspaceId) {
      createRequest({
        parentId: requestGroup._id,
        requestType, workspaceId: activeWorkspaceId,
      });
    }
  }, [activeWorkspaceId, requestGroup._id]);

  useImperativeHandle(ref, () => ({
    show: () => {
      dropdownRef.current?.show();
    },
  }));

  const onOpen = useCallback(async () => {
    const actionPlugins = await getRequestGroupActions();
    setActionPlugins(actionPlugins);
  }, []);

  const handleRequestGroupDuplicate = useCallback(() => {
    showPrompt({
      title: 'Duplicate Folder',
      defaultValue: requestGroup.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async (name: string) => {
        const newRequestGroup = await models.requestGroup.duplicate(requestGroup, {
          name,
        });
        models.stats.incrementCreatedRequestsForDescendents(newRequestGroup);
      },
    });
  }, [requestGroup]);

  const createGroup = useCallback(() => {
    createRequestGroup(requestGroup._id);
  }, [requestGroup._id]);

  const handleRename = useCallback(() => {
    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => {
        requestOperations.update(requestGroup, { name });
      },
    });
  }, [requestGroup]);

  const handleDeleteFolder = useCallback(async () => {
    await models.stats.incrementDeletedRequestsForDescendents(requestGroup);
    models.requestGroup.remove(requestGroup);
  }, [requestGroup]);

  const handlePluginClick = useCallback(async ({ label, plugin, action }: RequestGroupAction) => {
    setLoadingActions({ ...loadingActions, [label]: true });

    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironmentId) as Record<string, any>),
      };
      const requests = await models.request.findByParentId(requestGroup._id);
      requests.sort((a, b) => a.metaSortKey - b.metaSortKey);
      await action(context, {
        requestGroup,
        requests,
      });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }

    setLoadingActions({
      ...loadingActions,
      [label]: false,
    });

    dropdownRef.current?.hide();

  }, [dropdownRef, loadingActions,  activeEnvironment, requestGroup, activeProject]);

  return (
    <Dropdown ref={dropdownRef} onOpen={onOpen} {...other}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={() => create('HTTP')}>
        <i className="fa fa-plus-circle" />New HTTP Request
        <DropdownHint keyBindings={hotKeyRegistry.request_createHTTP} />
      </DropdownItem>

      <DropdownItem  onClick={() => create('GraphQL')}>
        <i className="fa fa-plus-circle" />New GraphQL Request
      </DropdownItem>

      <DropdownItem  onClick={() => create('gRPC')}>
        <i className="fa fa-plus-circle" />New gRPC Request
      </DropdownItem>

      <DropdownItem  onClick={() => create('WebSocket')}>
        <i className="fa fa-plus-circle" />WebSocket Request
      </DropdownItem>

      <DropdownItem onClick={createGroup}>
        <i className="fa fa-folder" /> New Folder
        <DropdownHint keyBindings={hotKeyRegistry.request_showCreateFolder} />
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={handleRequestGroupDuplicate}>
        <i className="fa fa-copy" /> Duplicate
      </DropdownItem>

      <DropdownItem onClick={() => showModal(EnvironmentEditModal, { requestGroup })}>
        <i className="fa fa-code" /> Environment
      </DropdownItem>

      <DropdownItem onClick={handleRename}>
        <i className="fa fa-edit" /> Rename
      </DropdownItem>

      <DropdownItem buttonClass={PromptButton} onClick={handleDeleteFolder}>
        <i className="fa fa-trash-o" /> Delete
      </DropdownItem>

      {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
      {actionPlugins.map((requestGroupAction: RequestGroupAction) => (
        <DropdownItem key={requestGroupAction.label} onClick={() => handlePluginClick(requestGroupAction)} stayOpenAfterClick>
          {loadingActions[requestGroupAction.label] ? (
            <i className="fa fa-refresh fa-spin" />
          ) : (
            <i className={classnames('fa', requestGroupAction.icon || 'fa-code')} />
          )}
          {requestGroupAction.label}
        </DropdownItem>
      ))}
      <DropdownDivider />
      <DropdownItem onClick={() => handleShowSettings(requestGroup)}>
        <i className="fa fa-wrench" /> Settings
      </DropdownItem>
    </Dropdown>
  );
});
RequestGroupActionsDropdown.displayName = 'RequestGroupActionsDropdown';
