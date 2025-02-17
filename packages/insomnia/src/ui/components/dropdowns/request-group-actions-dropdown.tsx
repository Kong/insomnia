import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { Fragment, useRef, useState } from 'react';
import { Button, Collection, Header, Menu, MenuItem, MenuTrigger, Popover, Section } from 'react-aria-components';
import { useFetcher, useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';

import { toKebabCase } from '../../../common/misc';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { PlatformKeyCombinations } from '../../../common/settings';
import * as models from '../../../models';
import type { Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import type { RequestGroupAction } from '../../../plugins';
import { getRequestGroupActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context/index';
import type { CreateRequestType } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { type DropdownHandle, type DropdownProps } from '../base/dropdown';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { Icon } from '../icon';
import { showError, showModal, showPrompt } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { PasteCurlModal } from '../modals/paste-curl-modal';
import { RequestGroupSettingsModal } from '../modals/request-group-settings-modal';
interface Props extends Partial<DropdownProps> {
  requestGroup: RequestGroup;
  isOpen: boolean;
  triggerRef: React.RefObject<HTMLDivElement>;
  onOpenChange: (isOpen: boolean) => void;
  onRename: () => void;
}

export const RequestGroupActionsDropdown = ({
  requestGroup,
  isOpen,
  triggerRef,
  onOpenChange,
  onRename,
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
  const navigate = useNavigate();

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

  const handleDeleteFolder = async () => {
    showModal(AskModal, {
      title: 'Delete Folder',
      message: `Do you really want to delete "${requestGroup.name}"?`,
      yesText: 'Delete',
      noText: 'Cancel',
      color: 'danger',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          models.stats.incrementDeletedRequestsForDescendents(requestGroup);
          requestFetcher.submit({ id: requestGroup._id },
            {
              action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request-group/delete`,
              method: 'post',
            });
        }
      },
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
  })[] =
    [
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
            action: () => createRequest({
              requestType: 'HTTP',
              parentId: requestGroup._id,
            }),
          },
          {
            id: 'Event Stream',
            name: 'Event Stream Request (SSE)',
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
          }],
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
            action: () =>
              setIsSettingsModalOpen(true),
          },
          {
            id: 'Delete',
            name: 'Delete',
            icon: 'trash',
            action: () =>
              handleDeleteFolder(),
          },
          {
            id: 'RunFolder',
            name: 'Run Folder',
            icon: 'circle-play',
            action: () => {
              navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner?folder=${requestGroup._id}`,);
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
          data-testid={`Dropdown-${toKebabCase(requestGroup.name)}`}
          aria-label="Request Group Actions"
          className="hidden items-center group-focus:flex group-hover:flex data-[focused]:flex aria-pressed:flex justify-center h-6 aspect-square aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        >
          <Icon icon="caret-down" />
        </Button>
        <Popover className="min-w-max overflow-y-hidden flex flex-col" triggerRef={triggerRef} placement="bottom end" offset={5}>
          <Menu
            aria-label="Request Group Actions Menu"
            selectionMode="single"
            onAction={key => requestGroupActionItems.find(i => i.items.find(a => a.id === key))?.items.find(a => a.id === key)?.action()}
            items={requestGroupActionItems}
            className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto h-full focus:outline-none"
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
          <RequestGroupSettingsModal
            requestGroup={requestGroup}
            onHide={() => setIsSettingsModalOpen(false)}
          />
        )
      }
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
