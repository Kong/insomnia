import classnames from 'classnames';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useFetcher, useParams } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { CreateRequestType } from '../../hooks/create-request';
import { selectActiveEnvironment, selectActiveProject, selectHotKeyRegistry } from '../../redux/selectors';
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
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const activeProject = useSelector(selectActiveProject);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const createRequestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

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

  const createGroup = () => {
    showPrompt({
      title: 'New Folder',
      defaultValue: 'My Folder',
      submitName: 'Create',
      label: 'Name',
      selectText: true,
      onComplete: async name => {
        createRequestFetcher.submit({ parentId: requestGroup._id, name },
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new-folder`,
            method: 'post',
          });
      },
    });
  };

  const handleRename = () => {
    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => createRequestFetcher.submit({ name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestGroup._id}/update`,
          method: 'post',
        }),
    });
  };

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

  }, [dropdownRef, loadingActions, activeEnvironment, requestGroup, activeProject]);

  const create = (requestType: CreateRequestType) =>
    createRequestFetcher.submit({ requestType, parentId: requestGroup?._id || '' },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      });

  return (
    <Dropdown ref={dropdownRef} onOpen={onOpen} dataTestId={`Dropdown-${toKebabCase(requestGroup.name)}`} {...other}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem onClick={() => create('HTTP')}>
        <i className="fa fa-plus-circle" />New HTTP Request
        <DropdownHint keyBindings={hotKeyRegistry.request_createHTTP} />
      </DropdownItem>

      <DropdownItem onClick={() => create('GraphQL')}>
        <i className="fa fa-plus-circle" />New GraphQL Request
      </DropdownItem>

      <DropdownItem onClick={() => create('gRPC')}>
        <i className="fa fa-plus-circle" />New gRPC Request
      </DropdownItem>

      <DropdownItem onClick={() => create('WebSocket')}>
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

      <DropdownItem
        buttonClass={PromptButton}
        onClick={() => {
          createRequestFetcher.submit({ id: requestGroup._id },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete-folder`,
              method: 'post',
            });
        }}
      >
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
      <DropdownItem onClick={() => handleShowSettings(requestGroup)} dataTestId={`DropdownItemSettings-${toKebabCase(requestGroup.name)}`}>
        <i className="fa fa-wrench" /> Settings
      </DropdownItem>
    </Dropdown>
  );
});
RequestGroupActionsDropdown.displayName = 'RequestGroupActionsDropdown';
