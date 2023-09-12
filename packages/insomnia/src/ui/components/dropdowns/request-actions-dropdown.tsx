import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useCallback, useState } from 'react';
import { Button, Item, Menu, MenuTrigger, Popover } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { exportHarRequest } from '../../../common/har';
import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { PlatformKeyCombinations } from '../../../common/settings';
import type { Environment } from '../../../models/environment';
import { GrpcRequest } from '../../../models/grpc-request';
import { Project } from '../../../models/project';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { incrementDeletedRequests } from '../../../models/stats';
// Plugin action related imports
import { WebSocketRequest } from '../../../models/websocket-request';
import type { RequestAction } from '../../../plugins';
import { getRequestActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { useRequestMetaPatcher, useRequestPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { Icon } from '../icon';
import { showError, showModal, showPrompt } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { GenerateCodeModal } from '../modals/generate-code-modal';
import { RequestSettingsModal } from '../modals/request-settings-modal';

interface Props {
  activeEnvironment: Environment;
  activeProject: Project;
  isPinned: Boolean;
  request: Request | GrpcRequest | WebSocketRequest;
  requestGroup?: RequestGroup;
}

export const RequestActionsDropdown = ({
  activeEnvironment,
  activeProject,
  isPinned,
  request,
}: Props) => {
  const {
    settings,
  } = useRootLoaderData();
  const patchRequestMeta = useRequestMetaPatcher();
  const patchRequest = useRequestPatcher();
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<RequestAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
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

  const handlePluginClick = async ({ plugin, action, label }: RequestAction) => {
    setLoadingActions({ ...loadingActions, [label]: true });

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
    setLoadingActions({ ...loadingActions, [label]: false });
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

  const handleRename = () => {
    showPrompt({
      title: 'Rename Request',
      defaultValue: request.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => patchRequest(request._id, { name }),
    });
  };

  const togglePin = () => {
    patchRequestMeta(request._id, { pinned: !isPinned });
  };

  const deleteRequest = () => {
    incrementDeletedRequests();
    requestFetcher.submit({ id: request._id },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/delete`,
        method: 'post',
      });
  };

  // Can only generate code for regular requests, not gRPC requests
  const canGenerateCode = isRequest(request);

  const codeGenerationActions: {
    id: string;
    name: string;
    icon: IconName;
    hint?: PlatformKeyCombinations;
    action: () => void;
  }[] = canGenerateCode ? [{
    id: 'GenerateCode',
    name: 'Generate Code',
    action: generateCode,
    icon: 'code',
    hint: hotKeyRegistry.request_showGenerateCodeEditor,
  }, {
    id: 'CopyAsCurl',
    name: 'Copy as cURL',
    action: copyAsCurl,
    icon: 'copy',
  }] : [];

  const requestActionList: {
    id: string;
    name: string;
    icon: IconName;
    hint?: PlatformKeyCombinations;
    action: () => void;
  }[] = [
      {
        id: 'Duplicate',
        name: 'Duplicate',
      action: handleDuplicateRequest,
        icon: 'copy',
      },
      {
        id: 'Rename',
        name: 'Rename',
        action: handleRename,
        icon: 'edit',
      },
      {
        id: 'Delete',
        name: 'Delete',
        action: deleteRequest,
        icon: 'trash',
      },
      {
        id: 'Pin',
        name: isPinned ? 'Unpin' : 'Pin',
        action: togglePin,
        icon: 'thumbtack',
      },
      ...codeGenerationActions,
      ...actionPlugins.map((plugin: RequestAction) => ({
        id: plugin.label,
        name: plugin.label,
        icon: loadingActions[plugin.label] ? 'refresh' : plugin.icon as IconName || 'plug',
        action: () => handlePluginClick(plugin),
      })),
      {
        id: 'Settings',
        name: 'Settings',
        icon: 'gear',
        hint: hotKeyRegistry.request_showSettings,
        action: () => {
          setIsSettingsModalOpen(true);
        },
      },
    ];

  return (
    <Fragment>
    <MenuTrigger onOpenChange={isOpen => isOpen && onOpen()}>
      <Button
        data-testid={`Dropdown-${toKebabCase(request.name)}`}
        aria-label="Request Actions"
        className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
      >
        <Icon icon="caret-down" />
      </Button>
      <Popover className="min-w-max">
        <Menu
          aria-label="Request Actions Menu"
          selectionMode="single"
          onAction={key =>
            requestActionList.find(({ id }) => key === id)?.action()
          }
          items={requestActionList}
          className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
        >
          {item => (
            <Item
              key={item.id}
              id={item.id}
              className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
              aria-label={item.name}
            >
              <Icon icon={item.icon} />
              <span>{item.name}</span>
            </Item>
          )}
        </Menu>
      </Popover>
    </MenuTrigger>
    {isSettingsModalOpen && (
      <RequestSettingsModal
        request={request}
        onHide={() => setIsSettingsModalOpen(false)}
      />
    )}
    </Fragment>
  );
};
