import classnames from 'classnames';
import React, { FC, useCallback, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { isRequest } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { isDesign, Workspace } from '../../../models/workspace';
import type { WorkspaceAction } from '../../../plugins';
import { ConfigGenerator, getConfigGenerators, getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { selectIsLoading } from '../../redux/modules/global';
import { selectActiveApiSpec, selectActiveEnvironment, selectActiveProject, selectActiveWorkspace, selectActiveWorkspaceName, selectSettings } from '../../redux/selectors';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showError, showModal } from '../modals';
import { showGenerateConfigModal } from '../modals/generate-config-modal';
import { SettingsModal, TAB_INDEX_EXPORT } from '../modals/settings-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

export const WorkspaceDropdown: FC = () => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeProject = useSelector(selectActiveProject);
  const isLoading = useSelector(selectIsLoading);
  const settings = useSelector(selectSettings);
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<WorkspaceAction[]>([]);
  const [configGeneratorPlugins, setConfigGeneratorPlugins] = useState<ConfigGenerator[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const handlePluginClick = useCallback(async ({ action, plugin, label }: WorkspaceAction, workspace: Workspace) => {
    setLoadingActions({ ...loadingActions, [label]: true });
    try {
      const activeEnvironmentId = activeEnvironment ? activeEnvironment._id : null;
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.network.init(activeEnvironmentId) as Record<string, any>),
      };
      const docs = await db.withDescendants(workspace);
      const requests = docs
        .filter(isRequest)
        .filter(doc => (
          !doc.isPrivate
        ));
      const requestGroups = docs.filter(isRequestGroup);
      await action(context, {
        requestGroups,
        requests,
        workspace,
      });
    } catch (err) {
      showError({
        title: 'Plugin Action Failed',
        error: err,
      });
    }
    setLoadingActions({ ...loadingActions, [label]: false });
    dropdownRef.current?.hide();
  }, [activeEnvironment, activeProject._id, loadingActions]);

  const handleDropdownOpen = useCallback(async () => {
    const actionPlugins = await getWorkspaceActions();
    const configGeneratorPlugins = await getConfigGenerators();
    setActionPlugins(actionPlugins);
    setConfigGeneratorPlugins(configGeneratorPlugins);
  }, []);

  const handleShowExport = useCallback(() => {
    showModal(SettingsModal, { tab: TAB_INDEX_EXPORT });
  }, []);

  const handleShowWorkspaceSettings = useCallback(() => {
    showModal(WorkspaceSettingsModal);
  }, []);

  const handleGenerateConfig = useCallback((label: string) => {
    if (!activeApiSpec) {
      return;
    }
    showGenerateConfigModal({
      apiSpec: activeApiSpec,
      activeTabLabel: label,
    });
  }, [activeApiSpec]);

  if (!activeWorkspace) {
    console.error('warning: tried to render WorkspaceDropdown without an activeWorkspace');
    return null;
  }

  return (
    <Dropdown
      beside
      ref={dropdownRef}
      className="wide workspace-dropdown"
      onOpen={handleDropdownOpen}
    >
      <DropdownButton className="row">
        <div
          className="ellipsis"
          style={{
            maxWidth: '400px',
          }}
          title={activeWorkspaceName}
        >
          {activeWorkspaceName}
        </div>
        <i className="fa fa-caret-down space-left" />
        {isLoading ? <i className="fa fa-refresh fa-spin space-left" /> : null}
      </DropdownButton>
      <DropdownItem onClick={handleShowWorkspaceSettings}>
        <i className="fa fa-wrench" /> {getWorkspaceLabel(activeWorkspace).singular} Settings
        <DropdownHint keyBindings={hotKeyRegistry.workspace_showSettings} />
      </DropdownItem>

      <DropdownItem onClick={handleShowExport}>
        <i className="fa fa-share" /> Import/Export
      </DropdownItem>
      {actionPlugins.length > 0 && <DropdownDivider>Plugins</DropdownDivider>}
      {actionPlugins.map((p: WorkspaceAction) => (
        <DropdownItem
          key={p.label}
          onClick={() => handlePluginClick(p, activeWorkspace)}
          stayOpenAfterClick
        >
          {loadingActions[p.label] ? (
            <i className="fa fa-refresh fa-spin" />
          ) : (
            <i className={classnames('fa', p.icon || 'fa-code')} />
          )}
          {p.label}
        </DropdownItem>
      ))}
      {isDesign(activeWorkspace) && (
        <>
          {configGeneratorPlugins.length > 0 && (
            <DropdownDivider>Config Generators</DropdownDivider>
          )}
          {configGeneratorPlugins.map((p: ConfigGenerator) => (
            <DropdownItem
              key="generateConfig"
              onClick={() => handleGenerateConfig(p.label)}
            >
              <i className="fa fa-code" />
              {p.label}
            </DropdownItem>
          ))}
        </>
      )}
    </Dropdown>
  );
};
