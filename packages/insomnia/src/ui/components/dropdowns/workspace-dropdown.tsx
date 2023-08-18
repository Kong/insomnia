import React, { FC, useCallback, useRef, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../../account/session';
import { getProductName } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { isRequest } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { isDesign, Workspace } from '../../../models/workspace';
import type { WorkspaceAction } from '../../../plugins';
import { getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { invariant } from '../../../utils/invariant';
import { useAIContext } from '../../context/app/ai-context';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { InsomniaAI } from '../insomnia-ai-icon';
import { showError, showPrompt } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { configGenerators, showGenerateConfigModal } from '../modals/generate-config-modal';
import { ImportModal } from '../modals/import-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

export const WorkspaceDropdown: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  invariant(organizationId, 'Expected organizationId');
  const {
    activeWorkspace,
    activeWorkspaceMeta,
    activeProject,
    activeApiSpec,
    clientCertificates,
    caCertificate,
    projects,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const activeWorkspaceName = activeWorkspace.name;
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const workspaceName = activeWorkspace.name;
  const projectName = activeProject.name ?? getProductName();
  const fetcher = useFetcher();

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
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.network.init() as Record<string, any>),
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
  }, [activeProject._id, loadingActions]);

  const handleDropdownOpen = useCallback(async () => {
    const actionPlugins = await getWorkspaceActions();
    setActionPlugins(actionPlugins);
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

  return (
    <>
      <Dropdown
        dataTestId='workspace-dropdown'
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
        <DropdownItem aria-label='Duplicate'>
          <ItemContent
            label="Duplicate"
            icon="copy"
            onClick={() => setIsDuplicateModalOpen(true)}
          />
        </DropdownItem>
        <DropdownItem aria-label='Rename'>
          <ItemContent
            label="Rename"
            icon="pen-to-square"
            onClick={() => {
              showPrompt({
                title: `Rename ${getWorkspaceLabel(activeWorkspace).singular}`,
                defaultValue: activeWorkspaceName,
                submitName: 'Rename',
                selectText: true,
                label: 'Name',
                onComplete: name =>
                  fetcher.submit(
                    { name, workspaceId: activeWorkspace._id },
                    {
                      action: `/organization/${organizationId}/project/${activeWorkspace.parentId}/workspace/update`,
                      method: 'post',
                      encType: 'application/json',
                    }
                  ),
              });
            }}
          />
        </DropdownItem>
        <DropdownSection aria-label='Meta section'>

          <DropdownItem aria-label='Import'>
            <ItemContent
              icon="file-import"
              label="Import"
              onClick={() => setIsImportModalOpen(true)}
            />
          </DropdownItem>

        <DropdownItem aria-label='Export'>
          <ItemContent
            icon="file-export"
            label="Export"
            onClick={() => setIsExportModalOpen(true)}
          />
        </DropdownItem>

          <DropdownItem aria-label="Settings">
            <ItemContent
              icon="wrench"
              label="Settings"
              onClick={() => setIsSettingsModalOpen(true)}
            />
          </DropdownItem>
        </DropdownSection>
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
      {isDuplicateModalOpen && (
        <WorkspaceDuplicateModal
          onHide={() => setIsDuplicateModalOpen(false)}
          workspace={activeWorkspace}
          projects={projects}
        />
      )}
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={projectName}
          workspaceName={workspaceName}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={workspaceId}
        />
      )}
      {isExportModalOpen && (
        <ExportRequestsModal
          workspace={activeWorkspace}
          onHide={() => setIsExportModalOpen(false)}
        />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={activeWorkspace}
          workspaceMeta={activeWorkspaceMeta}
          clientCertificates={clientCertificates}
          caCertificate={caCertificate}
          onHide={() => setIsSettingsModalOpen(false)}
        />
      )}
    </>
  );
};
