import React from 'react';
import { GridList, type Key, type Selection } from 'react-aria-components';
import { useNavigate } from 'react-router-dom';

import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { Icon } from '../icon';
import { type BaseTab, InsomniaTab, TabEnum } from './tab';

export interface OrganizationTabs {
  tabList: BaseTab[];
  activeTabId?: Key | null;
}

export const TAB_ROUTER_PATH: Record<TabEnum, string> = {
  [TabEnum.Collection]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug',
  [TabEnum.Folder]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request-group/:requestGroupId',
  [TabEnum.Request]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId',
  [TabEnum.Env]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/environment',
  [TabEnum.Mock]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server',
  [TabEnum.Runner]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/runner',
  [TabEnum.Document]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/spec',
  [TabEnum.MockRoute]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/mock-server/mock-route/:mockRouteId',
  [TabEnum.TEST]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
  [TabEnum.TESTSUITE]: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/*',
};

export const OrganizationTabList = ({ showActiveStatus = true }) => {
  const { currentOrgTabs } = useInsomniaTabContext();
  const { tabList, activeTabId } = currentOrgTabs;
  console.log('activeTabId', activeTabId);
  const navigate = useNavigate();

  const { changeActiveTab } = useInsomniaTabContext();

  const handleSelectionChange = (keys: Selection) => {
    console.log('changeActiveTab');
    if (keys !== 'all') {
      console.log('tab change', keys);
      const key = [...keys.values()]?.[0] as string;
      const tab = tabList.find(tab => tab.id === key);
      tab?.url && navigate(tab?.url);
      changeActiveTab(key);
    }
  };

  if (!tabList.length) {
    return null;
  };

  return (
    <div className='flex items-center border-b border-solid border-[--hl-sm]'>
      <GridList
        aria-label="Insomnia Tabs"
        onSelectionChange={handleSelectionChange}
        selectedKeys={showActiveStatus && activeTabId ? [activeTabId] : []}
        disallowEmptySelection
        defaultSelectedKeys={['req_737492dce0c3460a8a55762e5d1bbd99']}
        selectionMode="single"
        selectionBehavior='replace'
        className="flex h-[40px]"
        items={tabList}
      >
        {item => <InsomniaTab tab={item} />}
      </GridList>
      <Icon icon="plus" className='ml-[15px] cursor-pointer' />
    </div>
  );
};
