import classnames from 'classnames';
import { HotKeyRegistry } from 'insomnia-common';
import React, { FC, forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { createRequest, CreateRequestType } from '../../../common/create-request';
import { hotKeyRefs } from '../../../common/hotkeys';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { selectActiveEnvironment, selectActiveProject, selectRootState } from '../../redux/selectors';
import { Dropdown, DropdownProps } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { PromptButton } from '../base/prompt-button';
import { showError, showModal } from '../modals';
import { EnvironmentEditModal } from '../modals/environment-edit-modal';

interface Props extends Partial<DropdownProps> {
  requestGroup: RequestGroup;
  hotKeyRegistry: HotKeyRegistry;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleShowSettings: (requestGroup: RequestGroup) => any;
  handleCreateRequestGroup: (requestGroup: string) => any;
}

export const RequestGroupActionsDropdown: FC<Props> = forwardRef(({
  requestGroup,
  hotKeyRegistry,
  handleShowSettings,
  handleDuplicateRequestGroup,
  handleCreateRequestGroup,
  ...other
}, ref) => {
  const [actionPlugins, setActionPlugins] = useState<RequestGroupAction[]>([]);
  const [loadingActions, setLoadingActions] = useState< Record<string, boolean>>({});
  const dropdownRef = useRef<Dropdown | null>(null);

  const activeProject = useSelector(selectActiveProject);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const rootState = useSelector(selectRootState);

  const create = useCallback((requestType: CreateRequestType) => {
    createRequest(rootState)(requestGroup._id, requestType);
  }, [requestGroup._id, rootState]);

  useImperativeHandle(ref, () => ({
    show: () => {
      dropdownRef.current?.show();
    },
  }));

  const onOpen = useCallback(() => {
    getRequestGroupActions().then(actionPlugins => {
      setActionPlugins(actionPlugins);
    });
  }, []);

  const handleRequestGroupDuplicate = useCallback(() => {
    handleDuplicateRequestGroup(requestGroup);
  }, [requestGroup, handleDuplicateRequestGroup]);

  const handleRequestGroupCreate = useCallback(() => {
    handleCreateRequestGroup(requestGroup._id);
  }, [handleCreateRequestGroup, requestGroup._id]);

  const handleDeleteFolder = useCallback(() => {
    models.stats.incrementDeletedRequestsForDescendents(requestGroup).then(() => {
      models.requestGroup.remove(requestGroup);
    });
  }, [requestGroup]);

  const handleEditEnvironment = useCallback(() => {
    showModal(EnvironmentEditModal, requestGroup);
  }, [requestGroup]);

  const handlePluginClick = useCallback(({ label, plugin, action }: RequestGroupAction) => {
    const fn = async () => {
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
    };
    fn();
  }, [dropdownRef, loadingActions,  activeEnvironment, requestGroup, activeProject]);

  return (
    <Dropdown ref={dropdownRef} onOpen={onOpen} {...other}>
      <DropdownButton>
        <i className="fa fa-caret-down" />
      </DropdownButton>

      <DropdownItem value="HTTP" onClick={create}>
        <i className="fa fa-plus-circle" />New HTTP Request
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_CREATE_HTTP.id]} />
      </DropdownItem>

      <DropdownItem value="GraphQL" onClick={create}>
        <i className="fa fa-plus-circle" />New GraphQL Request
      </DropdownItem>

      <DropdownItem value="gRPC" onClick={create}>
        <i className="fa fa-plus-circle" />New gRPC Request
      </DropdownItem>

      <DropdownItem onClick={handleRequestGroupCreate}>
        <i className="fa fa-folder" /> New Folder
        <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]} />
      </DropdownItem>

      <DropdownDivider />

      <DropdownItem onClick={handleRequestGroupDuplicate}>
        <i className="fa fa-copy" /> Duplicate
      </DropdownItem>

      <DropdownItem onClick={handleEditEnvironment}>
        <i className="fa fa-code" /> Environment
      </DropdownItem>

      <DropdownItem buttonClass={PromptButton} addIcon onClick={handleDeleteFolder}>
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
      <DropdownItem onClick={handleShowSettings}>
        <i className="fa fa-wrench" /> Settings
      </DropdownItem>
    </Dropdown>
  );
});
RequestGroupActionsDropdown.displayName = 'RequestGroupActionsDropdown';
