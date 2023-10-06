import { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useRef, useState } from 'react';
import { Button, Item, Menu, MenuTrigger, Popover } from 'react-aria-components';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import { PlatformKeyCombinations } from '../../../common/settings';
import * as models from '../../../models';
import { Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import { CreateRequestType, useRequestGroupPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { type DropdownHandle, type DropdownProps } from '../base/dropdown';
import { Icon } from '../icon';
import { showError, showModal, showPrompt } from '../modals';
import { EnvironmentEditModal } from '../modals/environment-edit-modal';
import { PasteCurlModal } from '../modals/paste-curl-modal';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';
interface Props extends Partial<DropdownProps> {
  requestGroup: RequestGroup;
}

export const RequestGroupActionsDropdown = ({
  requestGroup,
}: Props) => {
  const {
    activeProject,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const {
    settings,
  } = useRootLoaderData();
  const { hotKeyRegistry } = settings;
  const [actionPlugins, setActionPlugins] = useState<RequestGroupAction[]>([]);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const dropdownRef = useRef<DropdownHandle>(null);

  const requestFetcher = useFetcher();
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };

  const createRequest = ({ requestType, parentId, req }: { requestType: CreateRequestType; parentId: string; req?: Partial<Request> }) =>
    requestFetcher.submit(JSON.stringify({ requestType, parentId, req }),
      {
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/new`,
        method: 'post',
      });

  const onOpen = async () => {
    const actionPlugins = await getRequestGroupActions();
    setActionPlugins(actionPlugins);
  };

  const handleRequestGroupDuplicate = () => {
    showPrompt({
      title: 'Duplicate Folder',
      defaultValue: requestGroup.name,
      submitName: 'Create',
      label: 'New Name',
      selectText: true,
      onComplete: async (name: string) => {
        requestFetcher.submit({ _id: requestGroup._id, name },
          {
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/duplicate`,
            method: 'post',
            encType: 'application/json',
          });
      },
    });
  };

  const patchGroup = useRequestGroupPatcher();
  const handleRename = () => {
    showPrompt({
      title: 'Rename Folder',
      defaultValue: requestGroup.name,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: name => patchGroup(requestGroup._id, { name }),
    });
  };

  const handleDeleteFolder = async () => {
    models.stats.incrementDeletedRequestsForDescendents(requestGroup);
    requestFetcher.submit({ id: requestGroup._id },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/delete`,
        method: 'post',
      });
  };

  const handlePluginClick = async ({ label, plugin, action }: RequestGroupAction) => {
    setLoadingActions({ ...loadingActions, [label]: true });

    try {
      const context = {
        ...(pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER) as Record<string, any>),
        ...pluginContexts.data.init(activeProject._id),
        ...(pluginContexts.store.init(plugin) as Record<string, any>),
        ...(pluginContexts.network.init() as Record<string, any>),
      };
      const requests = await models.request.findByParentId(requestGroup._id);
      requests.sort((a, b) => a.metaSortKey - b.metaSortKey);
      await action(context, {
        requestGroup,
        requests,
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

  const requestGroupActionItems: ({
    id: string;
    name: string;
    icon: IconName;
    hint?: PlatformKeyCombinations;
    action: () => void;
  })[] = [
      {
        id: 'HTTP',
        name: 'HTTP Request',
        icon: 'plus-circle',
        hint: hotKeyRegistry.request_createHTTP,
      action: () => createRequest({
        requestType: 'HTTP',
        parentId: requestGroup._id,
      }),
      },
      {
        id: 'Event Stream',
        name: 'Event Stream Request',
        icon: 'plus-circle',
        action: () => createRequest({
          requestType: 'Event Stream',
          parentId: requestGroup._id,
        }),
      },
      {
        id: 'GraphQL Request',
        name: 'GraphQL Request',
        icon: 'plus-circle',
        action: () => createRequest({
          requestType: 'GraphQL',
          parentId: requestGroup._id,
        }),
      },
      {
        id: 'gRPC Request',
        name: 'gRPC Request',
        icon: 'plus-circle',
        action: () => createRequest({
          requestType: 'gRPC',
          parentId: requestGroup._id,
        }),
      },
      {
        id: 'WebSocket Request',
        name: 'WebSocket Request',
        icon: 'plus-circle',
        action: () => createRequest({
          requestType: 'WebSocket',
          parentId: requestGroup._id,
        }),
      },
      {
        id: 'From Curl',
        name: 'From Curl',
        icon: 'terminal',
        action: () => setPasteCurlModalOpen(true),

      },
      {
        id: 'New Folder',
        name: 'New Folder',
        icon: 'folder',
        action: () =>
          showPrompt({
            title: 'New Folder',
            defaultValue: 'My Folder',
            submitName: 'Create',
            label: 'Name',
            selectText: true,
            onComplete: name => requestFetcher.submit({ parentId: requestGroup._id, name },
              {
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/new`,
                method: 'post',
              }),
          }),
      },
      {
        id: 'Duplicate',
        name: 'Duplicate',
        icon: 'copy',
        hint: hotKeyRegistry.request_createHTTP,
        action: () => handleRequestGroupDuplicate(),
      },
      {
        id: 'Environment',
        name: 'Environment',
        icon: 'code',
        action: () => showModal(EnvironmentEditModal, { requestGroup }),
      },
      {
        id: 'Rename',
        name: 'Rename',
        icon: 'edit',
        action: () =>
          handleRename(),
      },
      {
        id: 'Delete',
        name: 'Delete',
        icon: 'trash',
        action: () =>
          handleDeleteFolder(),
      },
      ...actionPlugins.map(plugin => ({
        id: plugin.label,
        name: plugin.label,
        icon: plugin.icon as IconName || 'plug',
        action: () =>
          handlePluginClick(plugin),
      })),
      {
        id: 'Settings',
        name: 'Settings',
        icon: 'wrench',
        action: () =>
          setIsSettingsModalOpen(true),
      },
    ];

  return (
    <Fragment>
    <MenuTrigger onOpenChange={isOpen => isOpen && onOpen()}>
      <Button
        data-testid={`Dropdown-${toKebabCase(requestGroup.name)}`}
        aria-label="Request Group Actions"
        className="opacity-0 items-center hover:opacity-100 focus:opacity-100 data-[pressed]:opacity-100 flex group-focus:opacity-100 group-hover:opacity-100 justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
      >
        <Icon icon="caret-down" />
      </Button>
      <Popover className="min-w-max">
        <Menu
          aria-label="Request Group Actions Menu"
          selectionMode="single"
          onAction={key => {
            const item = requestGroupActionItems.find(a => a.id === key);
            item && item.action();
          }}
          items={requestGroupActionItems}
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
      <RequestGroupSettingsModal
        requestGroup={requestGroup}
        onHide={() => setIsSettingsModalOpen(false)}
      />
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
