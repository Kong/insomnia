import type { IconName, IconProp } from '@fortawesome/fontawesome-svg-core';
import {
  exportGlobalEnvironmentToFile,
  exportMcpClientToFile,
  exportMockServerToFile,
} from 'insomnia/src/ui/components/settings/import-export';
import React, { Fragment, useState } from 'react';
import {
  Button,
  Collection,
  Dialog,
  Header,
  Heading,
  Label,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Radio,
  RadioGroup,
  SubmenuTrigger,
} from 'react-aria-components';
import { href } from 'react-router';

import type { Project, Workspace } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import type { PlatformKeyCombinations } from '~/insomnia-data/common';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import type { CreateRequestType } from '~/ui/hooks/use-request';

import { getProductName, SORT_ORDERS, type SortOrder, sortOrderName } from '../../../common/constants';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { AnalyticsEvent } from '../../analytics';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showModal } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal/import-modal';
import { PasteCurlModal } from '../modals/paste-curl-modal';
import { PromptModal } from '../modals/prompt-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';

interface Props {
  workspace: Workspace;
  project: Project;
  organizationId: string;
  sortOrder?: SortOrder;
  onSortOrderChange: (newSortOrder: SortOrder) => void;
}

interface ActionItem {
  id: string;
  name: string;
  icon: IconName;
  hint?: PlatformKeyCombinations;
  action: () => void;
  className?: string;
  hasSubmenu?: boolean;
  submenuItems?: Omit<ActionItem, 'icon'>[];
}

interface ActionSection {
  name: string;
  id: string;
  icon: IconProp;
  items: ActionItem[];
}

export const SidebarWorkspaceDropdown = ({
  workspace,
  project,
  organizationId,
  sortOrder,
  onSortOrderChange,
}: Props) => {
  const projectId = project._id;
  const workspaceId = workspace._id;

  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPasteCurlModalOpen, setPasteCurlModalOpen] = useState(false);

  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const newRequestFetcher = useRequestNewActionFetcher();
  const newRequestGroupFetcher = useRequestGroupNewActionFetcher();

  const tabNavigate = useTabNavigate();

  const workspaceName = workspace.name;
  const projectName = project.name || getProductName();
  const isCollection = workspace.scope === 'collection';

  const createRequest = (requestType: CreateRequestType) => {
    newRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      requestType,
      parentId: workspaceId,
    });
  };

  const openInNewTab = (isRunner = false) => {
    tabNavigate(
      { organization: organizationId, project, workspace, item: workspace },
      isRunner ? { shouldNavigate: true, asRunner: true } : { withTab: true, shouldNavigate: true },
    );
  };

  const createSections: ActionSection[] = isCollection
    ? [
        {
          name: 'Create',
          id: 'create',
          icon: 'plus',
          items: [
            {
              id: 'New Folder',
              name: 'New Folder',
              icon: 'folder',
              action: () =>
                showModal(PromptModal, {
                  title: 'New Folder',
                  defaultValue: 'My Folder',
                  submitName: 'Create',
                  label: 'Name',
                  selectText: true,
                  onComplete: (name: string) =>
                    newRequestGroupFetcher.submit({
                      organizationId,
                      projectId,
                      workspaceId,
                      parentId: workspaceId,
                      name,
                    }),
                }),
            },
            {
              id: 'HTTP',
              name: 'HTTP Request',
              icon: 'plus-circle',
              action: () => createRequest('HTTP'),
            },
            {
              id: 'Event Stream',
              name: 'Event Stream Request (SSE)',
              icon: 'plus-circle',
              action: () => createRequest('Event Stream'),
            },
            {
              id: 'GraphQL Request',
              name: 'GraphQL Request',
              icon: 'plus-circle',
              action: () => createRequest('GraphQL'),
            },
            {
              id: 'gRPC Request',
              name: 'gRPC Request',
              icon: 'plus-circle',
              action: () => createRequest('gRPC'),
            },
            {
              id: 'WebSocket Request',
              name: 'WebSocket Request',
              icon: 'plus-circle',
              action: () => createRequest('WebSocket'),
            },
            {
              id: 'Socket.IO Request',
              name: 'Socket.IO Request',
              icon: 'plus-circle',
              action: () => createRequest('SocketIO'),
            },
          ],
        },
        {
          name: 'Import',
          id: 'import-create',
          icon: 'file-import',
          items: [
            {
              id: 'From Curl',
              name: 'From Curl',
              icon: 'terminal',
              action: () => setPasteCurlModalOpen(true),
            },
            {
              id: 'from-file',
              name: 'From File',
              icon: 'file-import',
              action: () => setIsImportModalOpen(true),
            },
          ],
        },
        {
          name: 'Run',
          id: 'run',
          icon: 'circle-play',
          items: [
            {
              id: 'RunCollection',
              name: 'Run Collection',
              icon: 'circle-play',
              action: () => openInNewTab(true),
            },
          ],
        },
      ]
    : [];

  const actionSection: ActionSection = {
    name: 'Actions',
    id: 'actions',
    icon: 'cog',
    items: [
      {
        id: 'OpenInNewTab',
        name: 'Open in New Tab',
        icon: 'external-link-alt',
        action: openInNewTab,
      },
      ...(!models.workspace.isMcp(workspace)
        ? [
            {
              id: 'Duplicate',
              name: 'Duplicate / Move',
              icon: 'copy' as IconName,
              action: () => setIsDuplicateModalOpen(true),
            },
          ]
        : []),
      ...(models.workspace.isCollection(workspace)
        ? [
            {
              id: 'Sort',
              name: 'Sort',
              icon: 'sort' as IconName,
              action: () => {},
              hasSubmenu: true,
              submenuItems: SORT_ORDERS.map(order => ({
                id: order,
                name: sortOrderName[order],
                action: () => onSortOrderChange(order),
              })),
            },
          ]
        : []),
      {
        id: 'Rename',
        name: 'Rename',
        icon: 'pen-to-square' as IconName,
        action: () =>
          showModal(PromptModal, {
            title: `Rename ${getWorkspaceLabel(workspace).singular}`,
            defaultValue: workspaceName,
            submitName: 'Rename',
            selectText: true,
            label: 'Name',
            onComplete: (name: string) =>
              updateWorkspaceFetcher.submit({
                organizationId,
                projectId,
                patch: { name, workspaceId },
              }),
          }),
      },
      {
        id: 'Export',
        name: 'Export',
        icon: 'file-export',
        action: () => {
          window.main.trackAnalyticsEvent({
            event: AnalyticsEvent.exportStarted,
            properties: { source: `${workspace.scope}-list` },
          });
          if (workspace.scope === 'mock-server') {
            return exportMockServerToFile(workspace);
          }
          if (workspace.scope === 'environment') {
            return exportGlobalEnvironmentToFile(workspace);
          }
          if (workspace.scope === 'mcp') {
            return exportMcpClientToFile(workspace);
          }
          return setIsExportModalOpen(true);
        },
      },
      {
        id: 'Settings',
        name: 'Settings',
        icon: 'gear',
        action: () => setIsSettingsModalOpen(true),
      },
      {
        id: 'Delete',
        name: 'Delete',
        icon: 'trash',
        className: 'text-(--color-danger)',
        action: () => setIsDeleteModalOpen(true),
      },
    ],
  };

  const allSections: ActionSection[] = [...createSections, actionSection];

  return (
    <Fragment>
      <MenuTrigger>
        <Button
          aria-label="SideBar Workspace Actions"
          className="hidden aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:flex group-hover:opacity-100 group-focus:flex group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:flex data-pressed:opacity-100"
        >
          <Icon icon="ellipsis" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden" placement="bottom end">
          <Menu
            aria-label="Workspace Actions Menu"
            selectionMode="single"
            onAction={key =>
              allSections
                .find(s => s.items.find(a => a.id === key))
                ?.items.find(a => a.id === key)
                ?.action()
            }
            items={allSections}
            className="max-h-128 min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item =>
                    !item.hasSubmenu ? (
                      <MenuItem
                        key={item.id}
                        id={item.id}
                        className={`flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold ${item.className ? ` ${item.className}` : ''}`}
                        aria-label={item.name}
                      >
                        <Icon icon={item.icon} className="h-4 w-3" />
                        <span>{item.name}</span>
                        {item.hint && <DropdownHint keyBindings={item.hint} />}
                      </MenuItem>
                    ) : (
                      <SubmenuTrigger>
                        <MenuItem
                          className={`flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold ${item.className ? ` ${item.className}` : ''}`}
                          aria-label={item.name}
                        >
                          <Icon icon={item.icon} className="h-4 w-3" />
                          <span>{item.name}</span>
                          <Icon icon="chevron-right" className="ml-auto" />
                        </MenuItem>
                        <Popover className="flex min-w-max flex-col overflow-y-hidden">
                          <Menu
                            aria-label={`${item.name} submenu`}
                            onAction={key => item.submenuItems?.find(s => s.id === key)?.action()}
                            items={item.submenuItems}
                            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                          >
                            {subItem => (
                              <MenuItem
                                id={subItem.id}
                                className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                                aria-label={subItem.name}
                              >
                                <span>{subItem.name}</span>
                                {sortOrder === subItem.id && (
                                  <Icon icon="check" className="h-4 w-3 justify-self-end text-(--color-success)" />
                                )}
                              </MenuItem>
                            )}
                          </Menu>
                        </Popover>
                      </SubmenuTrigger>
                    )
                  }
                </Collection>
              </MenuSection>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>

      {isDuplicateModalOpen && (
        <WorkspaceDuplicateModal workspace={workspace} onHide={() => setIsDuplicateModalOpen(false)} />
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
        <ExportRequestsModal workspaceIdToExport={workspaceId} onClose={() => setIsExportModalOpen(false)} />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal workspace={workspace} project={project} onClose={() => setIsSettingsModalOpen(false)} />
      )}
      {isDeleteModalOpen && (
        <ModalOverlay
          isOpen
          onOpenChange={() => setIsDeleteModalOpen(false)}
          isDismissable
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => setIsDeleteModalOpen(false)}
            className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
          >
            <Dialog className="outline-hidden">
              {({ close }) => (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-2xl">Delete {getWorkspaceLabel(workspace).singular}</Heading>
                    <Button
                      className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={href(`/organization/:organizationId/project/:projectId/workspace/delete`, {
                      organizationId,
                      projectId: workspace.parentId,
                    })}
                    method="POST"
                    className="flex flex-col gap-4"
                  >
                    <input type="hidden" name="workspaceId" value={workspaceId} />
                    <div>
                      <p className="line-clamp-5">
                        This will permanently delete the{' '}
                        <strong className="break-all whitespace-pre-wrap">{workspaceName}</strong>{' '}
                        {getWorkspaceLabel(workspace).singular}
                      </p>
                      {models.project.isRemoteProject(project) && (
                        <RadioGroup name="localOnly" defaultValue="false" className="mb-2 flex flex-col gap-2">
                          <Label className="text-sm text-(--hl)">How do you want to delete it?</Label>
                          <div className="flex gap-2">
                            <Radio
                              value="true"
                              aria-label="Remove Local Copy"
                              className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                            >
                              <div>
                                <Heading className="text-lg font-bold">Remove Local Copy</Heading>
                                <p className="pt-2">The project will still exist on the Cloud.</p>
                              </div>
                            </Radio>
                            <Radio
                              value="false"
                              aria-label="Delete Permanently"
                              className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                            >
                              <div>
                                <Heading className="text-lg font-bold">Delete Permanently</Heading>
                                <p className="pt-2">
                                  The project will be deleted everywhere. You cannot undo this action.
                                </p>
                              </div>
                            </Radio>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                    {deleteWorkspaceFetcher.data?.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">{deleteWorkspaceFetcher.data.error}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        aria-label="Delete Workspace"
                        className="rounded-xs border border-solid border-(--hl-md) bg-(--color-danger) px-3 py-2 text-(--color-font-danger) transition-colors hover:bg-(--color-danger)/90 hover:no-underline"
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
      {isPasteCurlModalOpen && (
        <PasteCurlModal
          onImport={req => {
            newRequestFetcher.submit({
              organizationId,
              projectId,
              workspaceId,
              requestType: 'From Curl',
              parentId: workspaceId,
              req,
            });
          }}
          onHide={() => setPasteCurlModalOpen(false)}
        />
      )}
    </Fragment>
  );
};
