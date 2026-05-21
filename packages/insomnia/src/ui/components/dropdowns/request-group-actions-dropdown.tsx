import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useRef, useState } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';
import { useParams } from 'react-router';

import type { Project, Request, RequestGroup, Workspace } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { plugins } from '~/plugins/renderer-bridge';
import { useRootLoaderData } from '~/root';
import { useRequestNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.new';
import { useRequestGroupDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';
import { useRequestGroupDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.duplicate';
import { useRequestGroupNewActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.new';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';

import { toKebabCase } from '../../../common/misc';
import type { PlatformKeyCombinations } from '../../../common/settings';
import type { SerializableActionMeta } from '../../../plugins/bridge-types';
import type { CreateRequestType } from '../../hooks/use-request';
import { type DropdownHandle, type DropdownProps } from '../base/dropdown';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { PasteCurlModal } from '../modals/paste-curl-modal';
import { PromptModal } from '../modals/prompt-modal';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';
interface Props extends Partial<DropdownProps> {
  requestGroup: RequestGroup;
  isOpen: boolean;
  triggerRef?: React.RefObject<HTMLDivElement>;
  activeProject: Project;
  activeWorkspace: Workspace;
  onOpenChange: (isOpen: boolean) => void;
  onRename: () => void;
}

export const RequestGroupActionsDropdown = ({
  requestGroup,
  triggerRef,
  isOpen,
  onOpenChange,
  onRename,
  activeProject,
  activeWorkspace,
}: Props) => {
  const { settings } = useRootLoaderData()!;
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<SerializableActionMeta[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const newRequestFetcher = useRequestNewActionFetcher();
  const newRequestGroupFetcher = useRequestGroupNewActionFetcher();
  const duplicateRequestGroupFetcher = useRequestGroupDuplicateActionFetcher();
  const deleteRequestGroupFetcher = useRequestGroupDeleteActionFetcher();

  const tabNavigate = useTabNavigate();

  const workspaceId = activeWorkspace._id;
  const projectId = activeProject._id;
  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const createRequest = ({
    requestType,
    parentId,
    req,
  }: {
    requestType: CreateRequestType;
    parentId: string;
    req?: Partial<Request>;
  }) =>
    newRequestFetcher.submit({
      organizationId,
      projectId,
      workspaceId,
      requestType,
      parentId,
      req,
    });

  const onOpen = async () => {
    const actionPlugins = await plugins.getRequestGroupActions();
    setActionPlugins(actionPlugins);
  };

  const handleRequestGroupDuplicate = () => {
    showModal(PromptModal, {
      title: 'Duplicate Folder',
      defaultValue: requestGroup.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async (name: string) => {
        duplicateRequestGroupFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          requestGroupData: {
            _id: requestGroup._id,
            name,
          },
        });
      },
    });
  };

  const handleDeleteFolder = async () => {
    showModal(AskModal, {
      title: 'Delete Folder',
      message: `Do you really want to delete "${requestGroup.name}"?`,
      yesText: 'Delete',
      noText: 'Cancel',
      color: 'danger',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          services.stats.incrementDeletedRequestsForDescendents(requestGroup);
          deleteRequestGroupFetcher.submit({ organizationId, projectId, workspaceId, id: requestGroup._id });
        }
      },
    });
  };

  const handlePluginClick = async ({ label, pluginName }: SerializableActionMeta) => {
    setLoadingActions({ ...loadingActions, [label]: true });

    try {
      const requests = await services.request.findByParentId(requestGroup._id);
      requests.sort((a, b) => a.metaSortKey - b.metaSortKey);
      await plugins.executeAction({
        type: 'requestGroup',
        pluginName,
        label,
        projectId: activeProject._id,
        domainData: { requestGroup, requests },
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

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isPasteCurlModalOpen, setPasteCurlModalOpen] = useState(false);

  const openInNewTab = () => {
    tabNavigate(
      {
        organization: organizationId,
        project: activeProject,
        workspace: activeWorkspace,
        item: requestGroup,
      },
      { withTab: true, shouldNavigate: true },
    );
  };

  const openRunner = () => {
    tabNavigate(
      {
        organization: organizationId,
        project: activeProject,
        workspace: activeWorkspace,
        item: requestGroup,
      },
      { shouldNavigate: true, asRunner: true },
    );
  };

  const requestGroupActionItems: {
    name: string;
    id: string;
    icon: IconName;
    items: {
      id: string;
      name: string;
      icon: IconName;
      hint?: PlatformKeyCombinations;
      action: () => void;
    }[];
  }[] = [
    {
      name: 'Create',
      id: 'create',
      icon: 'plus',
      items: [
        {
          id: 'HTTP',
          name: 'HTTP Request',
          icon: 'plus-circle',
          hint: hotKeyRegistry.request_createHTTP,
          action: () =>
            createRequest({
              requestType: 'HTTP',
              parentId: requestGroup._id,
            }),
        },
        {
          id: 'Event Stream',
          name: 'Event Stream Request (SSE)',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'Event Stream',
              parentId: requestGroup._id,
            }),
        },
        {
          id: 'GraphQL Request',
          name: 'GraphQL Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'GraphQL',
              parentId: requestGroup._id,
            }),
        },
        {
          id: 'gRPC Request',
          name: 'gRPC Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'gRPC',
              parentId: requestGroup._id,
            }),
        },
        {
          id: 'WebSocket Request',
          name: 'WebSocket Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'WebSocket',
              parentId: requestGroup._id,
            }),
        },
        {
          id: 'Socket.IO Request',
          name: 'Socket.IO Request',
          icon: 'plus-circle',
          action: () =>
            createRequest({
              requestType: 'SocketIO',
              parentId: requestGroup._id,
            }),
        },
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
              onComplete: name =>
                newRequestGroupFetcher.submit({
                  organizationId,
                  projectId,
                  workspaceId,
                  parentId: requestGroup._id,
                  name,
                }),
            }),
        },
      ],
    },
    {
      name: 'Import',
      id: 'import',
      icon: 'file-import',
      items: [
        {
          id: 'From Curl',
          name: 'From Curl',
          icon: 'terminal',
          action: () => setPasteCurlModalOpen(true),
        },
      ],
    },
    {
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
        {
          id: 'Duplicate',
          name: 'Duplicate',
          icon: 'copy',
          action: () => handleRequestGroupDuplicate(),
        },
        {
          id: 'Rename',
          name: 'Rename',
          icon: 'edit',
          action: onRename,
        },
        {
          id: 'Settings',
          name: 'Settings',
          icon: 'wrench',
          action: () => setIsSettingsModalOpen(true),
        },
        {
          id: 'Delete',
          name: 'Delete',
          icon: 'trash',
          action: () => handleDeleteFolder(),
        },
        {
          id: 'RunFolder',
          name: 'Run Folder',
          icon: 'circle-play',
          action: () => openRunner(),
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
              icon: (plugin.icon as IconName) || 'plug',
              action: () => handlePluginClick(plugin),
            })),
          },
        ]
      : []),
  ];

  return (
    <Fragment>
      <MenuTrigger
        isOpen={isOpen}
        onOpenChange={isOpen => {
          isOpen && onOpen();
          onOpenChange(isOpen);
        }}
      >
        <Button
          data-testid={`Dropdown-${toKebabCase(requestGroup.name)}`}
          aria-label="Request Group Actions"
          className="hidden aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:flex group-hover:opacity-100 group-focus:flex group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:flex data-pressed:opacity-100"
        >
          <Icon icon="ellipsis" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden" triggerRef={triggerRef}>
          <Menu
            aria-label="Request Group Actions Menu"
            selectionMode="single"
            onAction={key =>
              requestGroupActionItems
                .find(i => i.items.find(a => a.id === key))
                ?.items.find(a => a.id === key)
                ?.action()
            }
            items={requestGroupActionItems}
            className="h-full min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs text-(--hl) uppercase">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                      aria-label={item.name}
                    >
                      <Icon icon={item.icon} />
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
      {isSettingsModalOpen && (
        <RequestGroupSettingsModal requestGroup={requestGroup} onHide={() => setIsSettingsModalOpen(false)} />
      )}
      {isPasteCurlModalOpen && (
        <PasteCurlModal
          onImport={req => {
            createRequest({
              requestType: 'From Curl',
              parentId: requestGroup._id,
              req,
            });
          }}
          onHide={() => setPasteCurlModalOpen(false)}
        />
      )}
    </Fragment>
  );
};
