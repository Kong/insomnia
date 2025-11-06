import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useCallback, useState } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuSection, MenuTrigger, Popover } from 'react-aria-components';
import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useRequestDuplicateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.duplicate';
import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';

import { exportHarRequest } from '../../../common/har';
import { toKebabCase } from '../../../common/misc';
import type { PlatformKeyCombinations } from '../../../common/settings';
import type { Environment } from '../../../models/environment';
import type { GrpcRequest } from '../../../models/grpc-request';
import type { Project } from '../../../models/project';
import { isRequest, type Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import type { SocketIORequest } from '../../../models/socket-io-request';
import { incrementDeletedRequests } from '../../../models/stats';
import type { WebSocketRequest } from '../../../models/websocket-request';
import type { RequestAction } from '../../../plugins';
import { getRequestActions } from '../../../plugins';
import * as pluginApp from '../../../plugins/context/app';
import * as pluginData from '../../../plugins/context/data';
import * as pluginNetwork from '../../../plugins/context/network';
import * as pluginStore from '../../../plugins/context/store';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';
import { PromptModal } from '../modals/prompt-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';

interface Props {
  activeEnvironment: Environment;
  activeProject: Project;
  isPinned: boolean;
  request: Request | GrpcRequest | WebSocketRequest | SocketIORequest;
  requestGroup?: RequestGroup;
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLDivElement>;
  onOpenChange: (isOpen: boolean) => void;
  onRename: () => void;
}

export const RequestActionsDropdown = ({
  activeEnvironment,
  activeProject,
  isPinned,
  request,
  isOpen,
  triggerRef,
  onOpenChange,
  onRename,
}: Props) => {
  const { settings } = useRootLoaderData()!;
  const patchRequestMeta = useRequestMetaPatcher();
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const duplicateRequestFetcher = useRequestDuplicateActionFetcher();
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const onOpen = useCallback(async () => {
    const actionPlugins = await getRequestActions();
    setActionPlugins(actionPlugins);
  }, []);

  const handleDuplicateRequest = () => {
    if (!request) {
      return;
    }

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

  const handlePluginClick = async ({ plugin, action }: RequestAction) => {
    try {
      const context = {
        ...pluginApp.init(),
        ...pluginData.init(activeProject._id),
        ...pluginStore.init(plugin),
        ...pluginNetwork.init(),
      };
      await action(context, {
        request,
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
      showModal(GenerateCodeModal, { request });
    }
  };

  const copyAsCurl = async () => {
    try {
      const har = await exportHarRequest(request._id, activeEnvironment._id);
      const HTTPSnippet = (await import('httpsnippet')).default;
      const snippet = new HTTPSnippet(har);
      const cmd = snippet.convert('shell', 'curl');

      if (cmd) {
        window.clipboard.writeText(cmd);
      }
    } catch (err) {
      showModal(AlertModal, {
        title: 'Could not generate cURL',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const togglePin = () => {
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
          incrementDeletedRequests();
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
          action: onRename,
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
          className="hidden aspect-square h-6 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) group-hover:flex group-focus:flex aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon="caret-down" />
        </Button>
        <Popover
          className="flex min-w-max flex-col overflow-y-hidden"
          triggerRef={triggerRef}
          placement="bottom end"
          offset={5}
        >
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
            className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg focus:outline-hidden"
          >
            {section => (
              <MenuSection className="flex flex-1 flex-col">
                <Header className="flex items-center gap-2 py-1 pl-2 text-xs uppercase text-(--hl)">
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="flex h-(--line-height-xs) w-full items-center gap-2 whitespace-nowrap bg-transparent px-(--padding-md) text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
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
