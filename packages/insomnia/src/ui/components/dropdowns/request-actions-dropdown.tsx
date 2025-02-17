import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useCallback, useState } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuTrigger, Popover, Section } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { exportHarRequest } from '../../../common/har';
import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { PlatformKeyCombinations } from '../../../common/settings';
import type { Environment } from '../../../models/environment';
import type { GrpcRequest } from '../../../models/grpc-request';
import type { Project } from '../../../models/project';
import { isRequest, type Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { incrementDeletedRequests } from '../../../models/stats';
// Plugin action related imports
// Plugin action related imports
import type { WebSocketRequest } from '../../../models/websocket-request';
import type { RequestAction } from '../../../plugins';
import { getRequestActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showError, showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';

interface Props {
  activeEnvironment: Environment;
  activeProject: Project;
  isPinned: Boolean;
  request: Request | GrpcRequest | WebSocketRequest;
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
  const {
    settings,
  } = useRootLoaderData();
  const patchRequestMeta = useRequestMetaPatcher();
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const onOpen = useCallback(async () => {
    const actionPlugins = await getRequestActions();
    setActionPlugins(actionPlugins);
  }, []);

  const handleDuplicateRequest = () => {
    if (!request) {
      return;
    }

    showPrompt({
      title: 'Duplicate Request',
      defaultValue: request.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: (name: string) => requestFetcher.submit({ name },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${request?._id}/duplicate`,
          method: 'post',
          encType: 'application/json',
        }),
    });
  };

  const handlePluginClick = async ({ plugin, action }: RequestAction) => {
    try {
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER)),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin)),
        ...(pluginContexts.network.init()),
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
          requestFetcher.submit({ id: request._id },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete`,
              method: 'post',
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
  }[] = !canGenerateCode ? [] :
      [{
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
      }];

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
      ...(actionPlugins.length > 0 ? [
        {
          name: 'Plugins',
          id: 'plugins',
          icon: 'plug' as IconName,
          items: actionPlugins.map(plugin => ({
            id: plugin.label,
            name: plugin.label,
            icon: plugin.icon as IconName || 'plug',
            action: () =>
              handlePluginClick(plugin),
          })),
        },
      ] : []),
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
          className="hidden items-center group-focus:flex group-hover:flex justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        >
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max overflow-y-hidden flex flex-col" triggerRef={triggerRef} placement="bottom end" offset={5}>
          <Menu
            aria-label="Request Actions Menu"
            selectionMode="single"
            onAction={key => requestActionList.find(i => i.items.find(a => a.id === key))?.items.find(a => a.id === key)?.action()}
            items={requestActionList}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
          >
            {section => (
              <Section className='flex-1 flex flex-col'>
                <Header className='pl-2 py-1 flex items-center gap-2 text-[--hl] text-xs uppercase'>
                  <Icon icon={section.icon} /> <span>{section.name}</span>
                </Header>
                <Collection items={section.items}>
                  {item => (
                    <MenuItem
                      key={item.id}
                      id={item.id}
                      className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                      aria-label={item.name}
                    >
                      <Icon icon={item.icon} />
                      <span>{item.name}</span>
                      {item.hint && (<DropdownHint keyBindings={item.hint} />)}
                    </MenuItem>
                  )}
                </Collection>
              </Section>
            )}
          </Menu>
        </Popover>
      </MenuTrigger>
      {
        isSettingsModalOpen && (
          <RequestSettingsModal
            request={request}
            onHide={() => setIsSettingsModalOpen(false)}
          />
        )
      }
    </Fragment >
  );
};
