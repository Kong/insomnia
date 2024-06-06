import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { FC, ReactNode, useCallback, useState } from 'react';
import { Button, Dialog, Heading, Menu, MenuItem, MenuTrigger, Modal, ModalOverlay, Popover } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { getProductName } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { exportMockServerToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { isRemoteProject } from '../../../models/project';
import { isRequest } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { isScratchpad, Workspace } from '../../../models/workspace';
import type { WorkspaceAction } from '../../../plugins';
import { getWorkspaceActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { invariant } from '../../../utils/invariant';
import { useAIContext } from '../../context/app/ai-context';
import { useRootLoaderData } from '../../routes/root';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Icon } from '../icon';
import { InsomniaAI } from '../insomnia-ai-icon';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showError, showPrompt } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

interface WorkspaceActionItem {
  id: string;
  name: string;
  icon: ReactNode;
  action: () => void;
}

export const WorkspaceDropdown: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  invariant(organizationId, 'Expected organizationId');
  const { userSession } = useRootLoaderData();
  const {
    activeWorkspace,
    activeProject,
    activeMockServer,
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
  const [isDeleteRemoteWorkspaceModalOpen, setIsDeleteRemoteWorkspaceModalOpen] = useState(false);
  const deleteWorkspaceFetcher = useFetcher();
  const [actionPlugins, setActionPlugins] = useState<WorkspaceAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const {
    access,
    generateTests,
  } = useAIContext();

  useDocBodyKeyboardShortcuts({
    workspace_showSettings: () => setIsSettingsModalOpen(true),
  });

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
  }, [activeProject._id, loadingActions]);

  const handleDropdownOpen = useCallback(async () => {
    const actionPlugins = await getWorkspaceActions();
    setActionPlugins(actionPlugins);
  }, []);

  const isScratchpadWorkspace = isScratchpad(activeWorkspace);

  const workspaceActionsList: WorkspaceActionItem[] = [
      ...!isScratchpadWorkspace ? [{
        id: 'duplicate',
        name: 'Duplicate',
        icon: <Icon icon='bars' />,
        action: () => setIsDuplicateModalOpen(true),
      },
      {
        id: 'rename',
        name: 'Rename',
        icon: <Icon icon='pen-to-square' />,
        action: () => {
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
        },
      },
      {
        id: 'delete',
        name: 'Delete',
        icon: <Icon icon='trash' />,
        action: () => {
          setIsDeleteRemoteWorkspaceModalOpen(true);
        },
      }] : [],
      {
        id: 'import',
        name: 'Import',
        icon: <Icon icon='file-import' />,
        action: () => setIsImportModalOpen(true),
      },
      {
        id: 'export',
        name: 'Export',
        icon: <Icon icon='file-export' />,
        action: () => activeWorkspace.scope !== 'mock-server'
          ? setIsExportModalOpen(true)
          : exportMockServerToFile(activeWorkspace),
      },
      {
        id: 'settings',
        name: 'Settings',
        icon: <Icon icon='wrench' />,
        action: () => setIsSettingsModalOpen(true),
      },
      ...actionPlugins.map((p: WorkspaceAction) => ({
        id: p.label,
        name: p.label,
        icon: <Icon icon={(loadingActions[p.label] ? 'refresh' : p.icon || 'code') as IconName} />,
        action: () => handlePluginClick(p, activeWorkspace),
      })),
    ...userSession.id && access.enabled && activeWorkspace.scope === 'design' ? [{
        id: 'insomnia-ai/generate-test-suite',
        name: 'Auto-generate Tests For Collection',
        action: generateTests,
        icon: <span className='flex items-center py-0 px-[--padding-xs]'>
          <InsomniaAI />
        </span>,
      }] : [],
    ];

  return (
    <>
      <MenuTrigger onOpenChange={isOpen => isOpen && handleDropdownOpen()}>
        <Button
          aria-label="Workspace actions"
          data-testid="workspace-context-dropdown"
          className="px-3 py-1 h-7 flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm truncate"
        >
          <span className="truncate" title={activeWorkspaceName}>{activeWorkspaceName}</span>
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max">
          <Menu
            aria-label="Create in project actions"
            selectionMode="single"
            onAction={key => {
              const item = workspaceActionsList.find(
                item => item.id === key
              );
              if (item) {
                item.action();
              }
            }}
            items={workspaceActionsList}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
          >
            {item => (
              <MenuItem
                key={item.id}
                id={item.id}
                className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                aria-label={item.name}
              >
                {item.icon}
                <span>{item.name}</span>
              </MenuItem>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
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
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={activeWorkspace}
          mockServer={activeMockServer}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
      {isDeleteRemoteWorkspaceModalOpen && (
        <ModalOverlay
          isOpen
          onOpenChange={() => {
            setIsDeleteRemoteWorkspaceModalOpen(false);
          }}
          isDismissable
          className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => {
              setIsDeleteRemoteWorkspaceModalOpen(false);
            }}
            className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
          >
            <Dialog
              className="outline-none"
            >
              {({ close }) => (
                <div className='flex flex-col gap-4'>
                  <div className='flex gap-2 items-center justify-between'>
                    <Heading className='text-2xl'>Delete {getWorkspaceLabel(activeWorkspace).singular}</Heading>
                    <Button
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={`/organization/${organizationId}/project/${activeWorkspace.parentId}/workspace/delete`}
                    method="POST"
                    className='flex flex-col gap-4'
                  >
                    <input type="hidden" name="workspaceId" value={activeWorkspace._id} />
                    <p>
                      This will permanently delete the {<strong style={{ whiteSpace: 'pre-wrap' }}>{activeWorkspace?.name}</strong>}{' '}
                      {getWorkspaceLabel(activeWorkspace).singular} {isRemoteProject(activeProject) ? 'remotely' : ''}.
                    </p>
                    {deleteWorkspaceFetcher.data && deleteWorkspaceFetcher.data.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">
                        {deleteWorkspaceFetcher.data.error}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="hover:no-underline bg-[--color-danger] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-danger] transition-colors rounded-sm"
                      >
                        Delete
                      </Button>
                    </div>
                  </deleteWorkspaceFetcher.Form>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </>
  );
};
