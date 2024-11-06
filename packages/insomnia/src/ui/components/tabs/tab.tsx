import React from 'react';
import { Button, GridListItem } from 'react-aria-components';

import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';

export const enum TabEnum {
  Request = 'request',
  Folder = 'folder',
  Env = 'environment',
  Mock = 'mock-server',
  MockRoute = 'mock-route',
  Document = 'document',
  Collection = 'collection',
  Runner = 'runner',
  TEST = 'test',
  TESTSUITE = 'test-suite',
};

export interface BaseTab {
  type: TabEnum;
  name: string;
  url: string;
  organizationId: string;
  projectId: string;
  workspaceId: string;
  organizationName: string;
  projectName: string;
  workspaceName: string;
  id: string;
  [key: string]: string;
};

const REQUEST_TAG_MAP: Record<string, string> = {
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

const WORKSPACE_TAB_UI_MAP: Record<string, any> = {
  [TabEnum.Collection]: {
    icon: 'bars',
    bgColor: 'bg-[--color-surprise]',
    textColor: 'text-[--color-font-surprise]',
  },
  [TabEnum.Env]: {
    icon: 'code',
    bgColor: 'bg-[--color-font]',
    textColor: 'text-[--color-bg]',
  },
  [TabEnum.Mock]: {
    icon: 'server',
    bgColor: 'bg-[--color-warning]',
    textColor: 'text-[--color-font-warning]',
  },
  [TabEnum.Document]: {
    icon: 'file',
    bgColor: 'bg-[--color-info]',
    textColor: 'text-[--color-font-info]',
  },
};

export const InsomniaTab = ({ tab }: { tab: BaseTab }) => {

  const { deleteTabById } = useInsomniaTabContext();

  const renderTabIcon = (type: TabEnum) => {
    if (WORKSPACE_TAB_UI_MAP[type]) {
      return (
        <div className={`${WORKSPACE_TAB_UI_MAP[type].bgColor} ${WORKSPACE_TAB_UI_MAP[type].textColor} px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm`}>
          <Icon icon={WORKSPACE_TAB_UI_MAP[type].icon} />
        </div>
      );
    }

    if (type === TabEnum.Request || type === TabEnum.MockRoute) {
      return (
        <span className={`w-10 flex-shrink-0 flex text-[0.65rem] rounded-sm border border-solid border-[--hl-sm] items-center justify-center ${REQUEST_TAG_MAP[tab.tag]}`}>{tab.tag}</span>
      );
    }

    if (type === TabEnum.Folder) {
      return <Icon icon="folder" />;
    }
    if (type === TabEnum.Runner) {
      return <Icon icon="play" />;
    };

    if (type === TabEnum.TESTSUITE) {
      return <Icon icon="check" />;
    }

    return null;
  };

  const handleClose = (id: string) => {
    deleteTabById(id);
  };

  return (
    <GridListItem
      textValue='tab'
      id={tab.id}
      className="outline-none"
    >
      {({ isSelected, isHovered }) => (
        <Tooltip message={`${tab.projectName} / ${tab.workspaceName}`} className='h-full'>
          <div className={`relative flex items-center h-full px-[20px] flex-nowrap border-solid border-r border-[--hl-sm] hover:text-[--color-font] outline-none max-w-[200px] cursor-pointer ${(!isSelected && !isHovered) && 'opacity-[0.7]'}`}>
            {renderTabIcon(tab.type)}
            <span className='ml-[8px] text-nowrap overflow-hidden text-ellipsis'>{tab.name}</span>
            <div className="bg-[--color-bg] h-[36px] w-[20px] flex justify-center items-center absolute right-0">
              {isHovered && (
                <Button className='hover:bg-[--hl-md] h-[15px] w-[15px] flex justify-center items-center' onPress={() => handleClose(tab.id)}>
                  <Icon icon="close" />
                </Button>
              )}
            </div>
            {isSelected && <span className='block absolute bottom-[-1px] left-0 right-0 h-[1px] bg-[--color-bg]' />}
          </div>
        </Tooltip>
      )}
    </GridListItem>
  );
};
