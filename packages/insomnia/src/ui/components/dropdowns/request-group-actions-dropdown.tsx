import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { CreateRequestType } from '../../hooks/use-request';
import { OrganizationLoaderData } from '../../routes/organization';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, type DropdownProps, DropdownSection, ItemContent } from '../base/dropdown';
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
  const {
    activeEnvironment,
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<RequestGroupAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const create = useCallback((requestType: CreateRequestType) =>
    requestFetcher.submit({ requestType, parentId: requestGroup._id },
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      }),
  [requestFetcher, organizationId, projectId, requestGroup?._id, workspaceId]);

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

  const createGroup = useCallback(() => showPrompt({
    title: 'New Folder',
    defaultValue: 'My Folder',
    submitName: 'Create',
    label: 'Name',
    selectText: true,
    onComplete: name => requestFetcher.submit({ parentId: requestGroup._id, name },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
        method: 'post',
      }),
  }), [requestFetcher, organizationId, projectId, requestGroup._id, workspaceId]);

  const handleRename = useCallback(() => {
    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => requestFetcher.submit({ _id: requestGroup._id, name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/update`,
          method: 'post',
          encType: 'application/json',
        }),
    });
  }, [requestFetcher, organizationId, projectId, requestGroup._id, requestGroup.name, workspaceId]);

  const handleDeleteFolder = useCallback(async () => {
    models.stats.incrementDeletedRequestsForDescendents(requestGroup);
    requestFetcher.submit({ id: requestGroup._id },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/delete`,
        method: 'post',
      });
  }, [requestFetcher, organizationId, projectId, requestGroup, workspaceId]);

  const handlePluginClick = useCallback(async ({ label, plugin, action }: RequestGroupAction) => {
    setLoadingActions({ ...loadingActions, [label]: true });

    try {
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironment._id) as Record<string, any>),
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
