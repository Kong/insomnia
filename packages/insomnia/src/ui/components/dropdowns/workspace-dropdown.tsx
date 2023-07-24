import React, { FC, useCallback, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { isLoggedIn } from '../../../account/session';
import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { isRequest } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { isDesign, Workspace } from '../../../models/workspace';
import type { WorkspaceAction } from '../../../plugins';
import { getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { useAIContext } from '../../context/app/ai-context';
import { selectActiveApiSpec, selectActiveEnvironment, selectActiveProject, selectActiveWorkspace, selectActiveWorkspaceName, selectSettings } from '../../redux/selectors';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { InsomniaAI } from '../insomnia-ai-icon';
import { showError, showModal } from '../modals';
import { configGenerators, showGenerateConfigModal } from '../modals/generate-config-modal';
import { SettingsModal, TAB_INDEX_EXPORT } from '../modals/settings-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

export const WorkspaceDropdown: FC = () => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeProject = useSelector(selectActiveProject);
  const settings = useSelector(selectSettings);
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<WorkspaceAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const {
    generating: loading,
    access,
    generateTests,
  } = useAIContext();

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
    setActionPlugins(actionPlugins);
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
      aria-label="Workspace Dropdown"
      ref={dropdownRef}
      closeOnSelect={false}
      className="wide workspace-dropdown"
      onOpen={handleDropdownOpen}
      triggerButton={
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
        </DropdownButton>
      }
    >
      <DropdownItem aria-label={`${getWorkspaceLabel(activeWorkspace).singular} Settings`}>
        <ItemContent
          icon="wrench"
          label={<>{getWorkspaceLabel(activeWorkspace).singular} Settings</>}
          hint={hotKeyRegistry.workspace_showSettings}
          onClick={handleShowWorkspaceSettings}
        />
      </DropdownItem>

      <DropdownItem aria-label='Import/Export'>
        <ItemContent
          icon="share"
          label="Import/Export"
          onClick={handleShowExport}
        />
      </DropdownItem>

      <DropdownSection
        aria-label='Plugins Section'
        title="Plugins"
      >
        {actionPlugins.map((p: WorkspaceAction) => (
          <DropdownItem
            key={p.label}
            aria-label={p.label}
          >
            <ItemContent
              icon={loadingActions[p.label] ? 'refresh fa-spin' : p.icon || 'code'}
              label={p.label}
              stayOpenAfterClick
              onClick={() => handlePluginClick(p, activeWorkspace)}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownSection
        aria-label='Config Generators Section'
        title="Config Generators"
        items={isDesign(activeWorkspace) ? configGenerators : []}
      >
        {p =>
          <DropdownItem
            key={`generateConfig-${p.label}`}
            aria-label={p.label}
          >
            <ItemContent
              icon="code"
              label={p.label}
              onClick={() => handleGenerateConfig(p.label)}
            />
          </DropdownItem>
        }
      </DropdownSection>

      <DropdownSection
        aria-label='AI'
        title="Insomnia AI"
        items={isLoggedIn() && access.enabled && activeWorkspace.scope === 'design' ? [{
          label: 'Auto-generate Tests For Collection',
          key: 'insomnia-ai/generate-test-suite',
          action: generateTests,
        }] : []}
      >
        {item =>
          <DropdownItem
            key={`generateConfig-${item.label}`}
            aria-label={item.label}
          >
            <ItemContent
              icon={
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 var(--padding-xs)',
                    width: 'unset',
                  }}
                >
                  <InsomniaAI />
                </span>}
              isDisabled={loading}
              label={item.label}
              onClick={item.action}
            />
          </DropdownItem>
        }
      </DropdownSection>
    </Dropdown>
  );
};
