import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { toKebabCase } from '../../../common/misc';
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
import { type DropdownHandle, type DropdownProps, Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
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

  }, [dropdownRef, loadingActions, activeEnvironment, requestGroup, activeProject]);

  return (
    <Dropdown
      {...other}
      aria-label="Request Group Actions Dropdown"
      ref={dropdownRef}
      onOpen={onOpen}
      dataTestId={`Dropdown-${toKebabCase(requestGroup.name)}`}
      closeOnSelect={false}
      triggerButton={
        <DropdownButton>
          <i className="fa fa-caret-down" />
        </DropdownButton>
      }
    >
      <DropdownItem aria-label='New HTTP Request'>
        <ItemContent
          icon="plus-circle"
          label="New HTTP Request"
          hint={hotKeyRegistry.request_createHTTP}
          onClick={() => create('HTTP')}
        />
      </DropdownItem>

      <DropdownItem aria-label='New GraphQL Request'>
        <ItemContent
          icon="plus-circle"
          label="New GraphQL Request"
          onClick={() => create('GraphQL')}
        />
      </DropdownItem>

      <DropdownItem aria-label='New gRPC Request'>
        <ItemContent
          icon="plus-circle"
          label="New gRPC Request"
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

      <DropdownSection aria-label='Actions Section'>
        <DropdownItem aria-label='Duplicate'>
          <ItemContent
            icon="copy"
            label="Duplicate"
            onClick={handleRequestGroupDuplicate}
          />
        </DropdownItem>

        <DropdownItem aria-label='Environment'>
          <ItemContent
            icon="code"
            label="Environment"
            onClick={() => showModal(EnvironmentEditModal, { requestGroup })}
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
            withPrompt
            onClick={handleDeleteFolder}
          />
        </DropdownItem>
      </DropdownSection>

      <DropdownSection
        aria-label='Plugins Section'
        title="Plugins"
      >
        {actionPlugins.map((requestGroupAction: RequestGroupAction) => (
          <DropdownItem
            key={requestGroupAction.label}
            aria-label={requestGroupAction.label}
          >
            <ItemContent
              icon={loadingActions[requestGroupAction.label] ? 'refresh fa-spin' : requestGroupAction.icon || 'fa-code'}
              label={requestGroupAction.label}
              onClick={() => handlePluginClick(requestGroupAction)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownSection aria-label='Settings Section'>
        <DropdownItem aria-label='Settings'>
          <ItemContent
            // dataTestId={`DropdownItemSettings-${toKebabCase(requestGroup.name)}`}
            icon="wrench"
            label="Settings"
            onClick={() => handleShowSettings(requestGroup)}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
});
RequestGroupActionsDropdown.displayName = 'RequestGroupActionsDropdown';
