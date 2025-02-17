import React, { useCallback } from 'react';
import { Button, GridListItem } from 'react-aria-components';

import { scrollElementIntoView } from '../../../utils';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';
import { TAB_CONTEXT_MENU_COMMAND } from './tab-list';

export type TabType = 'request' | 'folder' | 'environment' | 'mockServer' | 'mockRoute' | 'document' | 'collection' | 'runner' | 'test' | 'testSuite';
export interface BaseTab {
  type: TabType;
  name: string;
  url: string;
  organizationId: string;
  projectId: string;
  workspaceId: string;
  projectName: string;
  workspaceName: string;
  id: string;
  // tag is used to display the request method in the tab
  // method is used to display the tag color
  tag?: string;
  method?: string;
};

const REQUEST_METHOD_STYLE_MAP: Record<string, string> = {
  'GET': 'text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)]',
  'POST': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
  'GQL': 'text-[--color-font-success] bg-[rgba(var(--color-success-rgb),0.5)]',
  'HEAD': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
  'OPTIONS': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
  'DELETE': 'text-[--color-font-danger] bg-[rgba(var(--color-danger-rgb),0.5)]',
  'PUT': 'text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]',
  'PATCH': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
  'WS': 'text-[--color-font-notice] bg-[rgba(var(--color-notice-rgb),0.5)]',
  'gRPC': 'text-[--color-font-info] bg-[rgba(var(--color-info-rgb),0.5)]',
};

const WORKSPACE_TAB_UI_MAP: Partial<Record<TabType, any>> = {
  collection: {
    icon: 'bars',
    bgColor: 'bg-[--color-surprise]',
    textColor: 'text-[--color-font-surprise]',
  },
  environment: {
    icon: 'code',
    bgColor: 'bg-[--color-font]',
    textColor: 'text-[--color-bg]',
  },
  mockServer: {
    icon: 'server',
    bgColor: 'bg-[--color-warning]',
    textColor: 'text-[--color-font-warning]',
  },
  document: {
    icon: 'file',
    bgColor: 'bg-[--color-info]',
    textColor: 'text-[--color-font-info]',
  },
};

export const InsomniaTab = ({ tab }: { tab: BaseTab }) => {

  const { closeTabById, currentOrgTabs } = useInsomniaTabContext();

  const renderTabIcon = (type: TabType) => {
    if (WORKSPACE_TAB_UI_MAP[type]) {
      return (
        <div className={`${WORKSPACE_TAB_UI_MAP[type].bgColor} ${WORKSPACE_TAB_UI_MAP[type].textColor} px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm`}>
          <Icon icon={WORKSPACE_TAB_UI_MAP[type].icon} />
        </div>
      );
    }

    if (type === 'request' || type === 'mockRoute') {
      return (
        <span aria-label='Tab Tag' className={`w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center ${REQUEST_METHOD_STYLE_MAP[tab?.method || tab?.tag || '']}`}>{tab.tag}</span>
      );
    }

    if (type === 'folder') {
      return <Icon icon="folder" />;
    }
    if (type === 'runner') {
      return <Icon icon="play" />;
    };

    if (type === 'testSuite') {
      return <Icon icon="check" />;
    }

    return null;
  };

  const handleClose = (id: string) => {
    closeTabById(id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    window.main.showContextMenu({
      key: 'insomniaTab',
      menuItems: [
        {
          label: TAB_CONTEXT_MENU_COMMAND.CLOSE_ALL,
        },
        {
          label: TAB_CONTEXT_MENU_COMMAND.CLOSE_OTHERS,
        },
      ],
      extra: {
        currentTabId: tab.id,
      },
    });
  };

  const scrollIntoView = useCallback((node: HTMLDivElement) => {
    if (node && currentOrgTabs.activeTabId === tab.id) {
      scrollElementIntoView(node, { behavior: 'instant' });
    }
  }, [currentOrgTabs.activeTabId, tab.id]);

  return (
    <GridListItem
      textValue={`tab-${tab.name}`}
      id={tab.id}
      className="outline-none aria-selected:text-[--color-font] aria-selected:bg-[--hl-sm] hover:bg-[--hl-xs]"
      ref={scrollIntoView}
    >
      {({ isSelected, isHovered }) => (
        <Tooltip delay={1000} message={`${tab.projectName} / ${tab.workspaceName}`} className='h-full'>
          <div onContextMenu={handleContextMenu} className={`relative flex items-center h-full px-[10px] flex-nowrap border-solid border-r border-[--hl-sm] hover:text-[--color-font] outline-none max-w-[200px] cursor-pointer ${(!isSelected && !isHovered) && 'opacity-[0.7]'}`}>
            {renderTabIcon(tab.type)}
            <span className='mx-[8px] text-nowrap overflow-hidden text-ellipsis'>{tab.name}</span>
            <Button className='hover:bg-[--hl-md] h-[15px] w-[15px] flex justify-center items-center' onPress={() => handleClose(tab.id)}>
              <Icon icon="close" />
            </Button>
            <span className={`block absolute bottom-[0px] left-0 right-0 h-[1px] bg-[--color-bg] ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
            <span className={`block absolute bottom-[0px] left-0 right-0 h-[1px] bg-[--hl-sm] ${!isSelected ? 'opacity-100' : 'opacity-0'}`} />
          </div>
          <Button slot="drag" className="hidden" />
        </Tooltip>
      )}
    </GridListItem>
  );
};
