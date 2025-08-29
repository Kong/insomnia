import type { IconName } from '@fortawesome/fontawesome-svg-core';
import {
  exportGlobalEnvironmentToFile,
  exportMockServerToFile,
} from 'insomnia/src/ui/components/settings/import-export';
import { type FC, type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Button,
  Collection,
  Dialog,
  Header,
  Heading,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
} from 'react-aria-components';
import { href, useNavigate, useParams } from 'react-router';

import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';

import { getProductName } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import type { PlatformKeyCombinations } from '../../../common/settings';
import * as models from '../../../models';
import { isRemoteProject } from '../../../models/project';
import { isRequest } from '../../../models/request';
import { isRequestGroup } from '../../../models/request-group';
import { isScratchpad, type Workspace } from '../../../models/workspace';
import type { WorkspaceAction } from '../../../plugins';
import { getWorkspaceActions } from '../../../plugins';
import * as pluginApp from '../../../plugins/context/app';
import * as pluginData from '../../../plugins/context/data';
import * as pluginNetwork from '../../../plugins/context/network';
import * as pluginStore from '../../../plugins/context/store';
import { useWorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { invariant } from '../../../utils/invariant';
import { SegmentEvent } from '../../analytics';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showError, showModal } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal/import-modal';
import { PromptModal } from '../modals/prompt-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

export const WorkspaceDropdown: FC<{}> = () => {
  const { organizationId, projectId, workspaceId } = useParams<{
    organizationId: string;
    projectId: string;
    workspaceId: string;
  }>();
  invariant(organizationId, 'Expected organizationId');
  const { activeWorkspace, activeWorkspaceMeta, activeProject, activeMockServer } = useWorkspaceLoaderData()!;

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const [isDeleteRemoteWorkspaceModalOpen, setIsDeleteRemoteWorkspaceModalOpen] = useState(false);
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const [actionPlugins, setActionPlugins] = useState<WorkspaceAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  // after duplicate workspace, close the modal
  useEffect(() => {
    setIsDuplicateModalOpen(false);
  }, [workspaceId]);

  useDocBodyKeyboardShortcuts({
    workspace_showSettings: () => setIsSettingsModalOpen(true),
  });

  const handlePluginClick = useCallback(
    async ({ action, plugin, label }: WorkspaceAction, workspace: Workspace) => {
      setLoadingActions({ ...loadingActions, [label]: true });
      try {
        const context = {
          ...(pluginApp.init() as Record<string, any>),
          ...pluginData.init(activeProject._id),
          ...(pluginStore.init(plugin) as Record<string, any>),
          ...(pluginNetwork.init() as Record<string, any>),
        };

        const docs = await db.getWithDescendants(workspace, [models.request.type]);
        const requests = docs.filter(isRequest).filter(doc => !doc.isPrivate);
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
    },
    [activeProject._id, loadingActions],
  );

  const handleDropdownOpen = useCallback(async () => {
    const actionPlugins = await getWorkspaceActions();
    setActionPlugins(actionPlugins);
  }, []);

  const isScratchpadWorkspace = isScratchpad(activeWorkspace);
  const scratchpadActionList: {
    name: string;
    id: string;
    icon: IconName;
    items: {
      id: string;
      name: string;
      icon: ReactNode;
      hint?: PlatformKeyCombinations;
      action: () => void;
    }[];
  }[] = [
    {
      name: 'Actions',
      id: 'Actions',
      icon: 'cog',
      items: [
        {
          id: 'Import',
          name: 'Import',
          icon: <Icon icon="file-import" />,
          action: () => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.importStarted,
              properties: {
                source: `scratchpad-${activeWorkspace.scope}-menu`,
              },
            });

            setIsImportModalOpen(true);
          },
        },
        {
          id: 'Export',
          name: 'Export',
          icon: <Icon icon="file-export" />,
          action: () => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.exportStarted,
              properties: {
                source: `scratchpad-${activeWorkspace.scope}-menu`,
              },
            });
            if (activeWorkspace.scope === 'mock-server') {
              return exportMockServerToFile(activeWorkspace);
            }

            if (activeWorkspace.scope === 'environment') {
              return exportGlobalEnvironmentToFile(activeWorkspace);
            }

            return setIsExportModalOpen(true);
          },
        },
      ],
    },
  ];

  const workspaceActionsList: {
    name: string;
    id: string;
    icon: IconName;
    items: {
      id: string;
      name: string;
      icon: ReactNode;
      hint?: PlatformKeyCombinations;
      action: () => void;
    }[];
  }[] = [
    {
      name: 'Import',
      id: 'import',
      icon: 'cog',
      items: [
        {
          id: 'from-file',
          name: 'From File',
          icon: <Icon icon="file-import" />,
          action: () => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.importStarted,
              properties: {
                source: `${activeWorkspace.scope}-menu`,
              },
            });
            setIsImportModalOpen(true);
          },
        },
      ],
    },
    {
      name: 'Runner',
      id: 'runner',
      icon: 'circle-play',
      items: [
        {
          id: 'run',
          name: 'Run Collection',
          icon: <Icon icon="circle-play" />,
          action: () => {
            navigate(
              `/organization/${organizationId}/project/${activeWorkspace.parentId}/workspace/${activeWorkspace._id}/debug/runner?folder=`,
            );
          },
        },
      ],
    },
    {
      name: 'Actions',
      id: 'actions',
      icon: 'cog',
      items: [
        {
          id: 'duplicate',
          name: 'Duplicate',
          icon: <Icon icon="bars" />,
          action: () => setIsDuplicateModalOpen(true),
        },
        {
          id: 'rename',
          name: 'Rename',
          icon: <Icon icon="pen-to-square" />,
          action: () =>
            showModal(PromptModal, {
              title: `Rename ${getWorkspaceLabel(activeWorkspace).singular}`,
              defaultValue: activeWorkspace.name,
              submitName: 'Rename',
              selectText: true,
              label: 'Name',
              onComplete: name =>
                updateWorkspaceFetcher.submit({
                  organizationId,
                  projectId: activeWorkspace.parentId,
                  patch: { name, workspaceId: activeWorkspace._id },
                }),
            }),
        },
        {
          id: 'export',
          name: 'Export',
          icon: <Icon icon="file-export" />,
          action: () => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.exportStarted,
              properties: {
                source: `${activeWorkspace.scope}-menu`,
              },
            });

            if (activeWorkspace.scope === 'mock-server') {
              return exportMockServerToFile(activeWorkspace);
            }

            if (activeWorkspace.scope === 'environment') {
              return exportGlobalEnvironmentToFile(activeWorkspace);
            }

            return setIsExportModalOpen(true);
          },
        },
        {
          id: 'settings',
          name: 'Settings',
          icon: <Icon icon="wrench" />,
          action: () => setIsSettingsModalOpen(true),
        },
        {
          id: 'delete',
          name: 'Delete',
          icon: <Icon icon="trash" />,
          action: () => setIsDeleteRemoteWorkspaceModalOpen(true),
        },
      ],
    },
    ...(actionPlugins.length > 0
      ? [
          {
            name: 'Plugins',
            id: 'plugins',
            icon: 'plug' as IconName,
            items: actionPlugins.map(plugin => ({
              id: plugin.label,
              name: plugin.label,
              icon: <Icon icon={(plugin.icon as IconName) || 'plug'} />,
              action: () => handlePluginClick(plugin, activeWorkspace),
            })),
          },
        ]
      : []),
  ];
  const actionlist = isScratchpadWorkspace ? scratchpadActionList : workspaceActionsList;
  return (
    <>
      <MenuTrigger onOpenChange={isOpen => isOpen && handleDropdownOpen()}>
        <Button
          aria-label="Workspace actions"
          data-testid="workspace-context-dropdown"
          className="flex h-7 flex-1 items-center justify-center gap-2 truncate rounded-sm px-3 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        >
          <span className="truncate" title={activeWorkspace.name}>
            {activeWorkspace.name}
          </span>
          <Icon icon="caret-down" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden">
          <Menu
            aria-label="Create in project actions"
            selectionMode="single"
            onAction={key =>
              actionlist
                .find(i => i.items.find(a => a.id === key))
                ?.items.find(a => a.id === key)
                ?.action()
            }
            items={actionlist}
            className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs uppercase text-[--hl]">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                      aria-label={item.name}
                    >
                      {item.icon}
                      <span>{item.name}</span>
                      {item.hint && <DropdownHint keyBindings={item.hint} />}
                    </MenuItem>
                  )}
                </Collection>
              </MenuSection>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {isDuplicateModalOpen && (
        <WorkspaceDuplicateModal onHide={() => setIsDuplicateModalOpen(false)} workspace={activeWorkspace} />
      )}
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={activeProject.name ?? getProductName()}
          workspaceName={activeWorkspace.name}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={workspaceId}
        />
      )}
      {isExportModalOpen && (
        <ExportRequestsModal workspaceIdToExport={activeWorkspace._id} onClose={() => setIsExportModalOpen(false)} />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={activeWorkspace}
          mockServer={activeMockServer}
          project={activeProject}
          gitFilePath={activeWorkspaceMeta?.gitFilePath}
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
          className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => {
              setIsDeleteRemoteWorkspaceModalOpen(false);
            }}
            className="max-h-full w-full max-w-2xl rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
          >
            <Dialog className="outline-none">
              {({ close }) => (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-2xl">Delete {getWorkspaceLabel(activeWorkspace).singular}</Heading>
                    <Button
                      className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={href(`/organization/:organizationId/project/:projectId/workspace/delete`, {
                      organizationId,
                      projectId: activeWorkspace.parentId,
                    })}
                    method="POST"
                    className="flex flex-col gap-4"
                  >
                    <input type="hidden" name="workspaceId" value={activeWorkspace._id} />
                    <p>
                      This will permanently delete the{' '}
                      {<strong style={{ whiteSpace: 'pre-wrap' }}>{activeWorkspace?.name}</strong>}{' '}
                      {getWorkspaceLabel(activeWorkspace).singular} {isRemoteProject(activeProject) ? 'remotely' : ''}.
                    </p>
                    {deleteWorkspaceFetcher.data && deleteWorkspaceFetcher.data.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">{deleteWorkspaceFetcher.data.error}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-sm border border-solid border-[--hl-md] bg-[--color-danger] px-3 py-2 text-[--color-font-danger] transition-colors hover:bg-opacity-90 hover:no-underline"
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
