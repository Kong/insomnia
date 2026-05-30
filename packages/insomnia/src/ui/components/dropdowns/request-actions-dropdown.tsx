import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useCallback, useState } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';
import { useParams } from 'react-router';

import type {
  GrpcRequest,
  Project,
  Request,
  RequestGroup,
  SocketIORequest,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import type { PlatformKeyCombinations } from '~/insomnia-data/common';
import { plugins } from '~/plugins/renderer-bridge';
import { useRootLoaderData } from '~/root';
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { AnalyticsEvent } from '~/ui/analytics';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';

import { exportHarRequest } from '../../../common/har';
import { toKebabCase } from '../../../common/misc';
import type { SerializableActionMeta } from '../../../plugins/bridge-types';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';
import { PromptModal } from '../modals/prompt-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';

const { isRequest } = models.request;

interface Props {
  isPinned: boolean;
  request: Request | GrpcRequest | WebSocketRequest | SocketIORequest;
  activeProject: Project;
  activeWorkspace: Workspace;
  requestGroup?: RequestGroup;
  isOpen: boolean;
  triggerRef?: React.RefObject<HTMLDivElement>;
  onOpenChange: (isOpen: boolean) => void;
  onRename: () => void;
}

export const RequestActionsDropdown = ({
  isPinned,
  request,
  isOpen,
  activeProject,
  activeWorkspace,
  triggerRef,
  onOpenChange,
  onRename,
}: Props) => {
  const workspaceId = activeWorkspace._id;
  const projectId = activeProject._id;
  const { settings } = useRootLoaderData()!;
  const patchRequestMeta = useRequestMetaPatcher(workspaceId);
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<SerializableActionMeta[]>([]);
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const deleteRequestFetcher = useRequestDeleteActionFetcher();

  const { organizationId } = useParams() as {
    organizationId: string;
  };

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const tabNavigate = useTabNavigate();

  const openInNewTab = async () => {
    window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestOpenInNewTabClicked });
    tabNavigate(
      {
        organization: organizationId,
        project: activeProject,
        workspace: activeWorkspace,
        item: request,
      },
      {
        withTab: true,
        shouldNavigate: true,
      },
    );
  };

  const onOpen = useCallback(async () => {
    const actionPlugins = await plugins.getRequestActions();
    setActionPlugins(actionPlugins);
  }, []);

  const handleDuplicateRequest = () => {
    if (!request) {
      return;
    }
    window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestListMenuDuplicateClicked });

    showModal(PromptModal, {
      title: 'Duplicate Request',
      defaultValue: request.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: (name: string) =>
        duplicateRequestFetcher.submit({
          organizationId,
          projectId,
          workspaceId,
          requestId: request._id,
          name,
        }),
    });
  };

  const handlePluginClick = async ({ pluginName, label }: SerializableActionMeta) => {
    try {
      await plugins.executeAction({
        type: 'request',
        pluginName,
        label,
        projectId: activeProject._id,
        domainData: { request },
      });
    } catch (error) {
      showError({
        title: 'Plugin Action Failed',
        error,
      });
    }
  };

  const generateCode = () => {
    if (isRequest(request)) {
      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.generateCodeClicked,
      });

      showModal(GenerateCodeModal, { request });
    }
  };

  const copyAsCurl = async () => {
    try {
      const har = await exportHarRequest(request._id, workspaceId);
      if (!har) {
        return;
      }
      const cmd = await window.main.generateCodeSnippet({ har, target: 'shell', client: 'curl' });

      if (cmd) {
        window.clipboard.writeText(cmd);
      }

      window.main.trackAnalyticsEvent({
        event: AnalyticsEvent.copyAsCurl,
      });
    } catch (err) {
      showModal(AlertModal, {
        title: 'Could not generate cURL',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const togglePin = () => {
    window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestListMenuPinClicked });
    patchRequestMeta(request._id, { pinned: !isPinned });
  };

  const deleteRequest = () => {
    showModal(AskModal, {
      title: 'Delete Request',
      message: `Do you really want to delete "${request.name}"?`,
      yesText: 'Delete',
      noText: 'Cancel',
      color: 'danger',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          services.stats.incrementDeletedRequests();
          deleteRequestFetcher.submit({
            organizationId,
            projectId,
            workspaceId,
            id: request._id,
          });
        }
      },
    });
  };

  // Can only generate code for regular requests, not gRPC requests
  const canGenerateCode = isRequest(request);

  const codeGenerationActions: {
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
  }[] = !canGenerateCode
    ? []
    : [
        {
          name: 'Export',
          id: 'export',
          icon: 'file-export',
          items: [
            {
              id: 'GenerateCode',
              name: 'Generate Code',
              action: generateCode,
              icon: 'code',
              hint: hotKeyRegistry.request_showGenerateCodeEditor,
            },
            {
              id: 'CopyAsCurl',
              name: 'Copy as cURL',
              action: copyAsCurl,
              icon: 'copy',
            },
          ],
        },
      ];

  const requestActionList: {
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
    ...codeGenerationActions,
    {
      name: 'Actions',
      id: 'actions',
      icon: 'cog',
      items: [
        {
          id: 'OpenInNewTab',
          name: 'Open in New Tab',
          action: openInNewTab,
          icon: 'external-link-alt',
          hint: hotKeyRegistry.request_openInNewTab,
        },
        {
          id: 'Pin',
          name: isPinned ? 'Unpin' : 'Pin',
          action: togglePin,
          icon: 'thumbtack',
          hint: hotKeyRegistry.request_togglePin,
        },
        {
          id: 'Duplicate',
          name: 'Duplicate',
          action: handleDuplicateRequest,
          icon: 'copy',
          hint: hotKeyRegistry.request_showDuplicate,
        },
        {
          id: 'Rename',
          name: 'Rename',
          action: () => {
            window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestListMenuRenameClicked });
            onRename();
          },
          icon: 'edit',
        },
        {
          id: 'Delete',
          name: 'Delete',
          action: deleteRequest,
          icon: 'trash',
          hint: hotKeyRegistry.request_showDelete,
        },
        {
          id: 'Settings',
          name: 'Settings',
          icon: 'gear',
          hint: hotKeyRegistry.request_showSettings,
          action: () => {
            window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestListMenuSettingsClicked });
            setIsSettingsModalOpen(true);
          },
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
          data-testid={`Dropdown-${toKebabCase(request.name)}`}
          aria-label="Request Actions"
          className="aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) opacity-0 ring-1 ring-transparent transition-all group-hover:flex group-hover:opacity-100 group-focus:flex group-focus:opacity-100 hover:bg-(--hl-xs) hover:opacity-100 focus:opacity-100 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm) data-pressed:flex data-pressed:opacity-100"
        >
          <Icon icon="ellipsis" />
        </Button>
        <Popover className="flex min-w-max flex-col overflow-y-hidden" triggerRef={triggerRef}>
          <Menu
            aria-label="Request Actions Menu"
            selectionMode="single"
            onAction={key =>
              requestActionList
                .find(i => i.items.find(a => a.id === key))
                ?.items.find(a => a.id === key)
                ?.action()
            }
            items={requestActionList}
            className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
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
      {isSettingsModalOpen && <RequestSettingsModal request={request} onHide={() => setIsSettingsModalOpen(false)} />}
    </Fragment>
  );
};
