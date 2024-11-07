import React, { useCallback, useEffect } from 'react';
import { GridList, type Selection } from 'react-aria-components';
import { useNavigate } from 'react-router-dom';

import { type ChangeBufferEvent, type ChangeType, database } from '../../../common/database';
import * as models from '../../../models/index';
import type { Request } from '../../../models/request';
import { INSOMNIA_TAB_HEIGHT } from '../../constant';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { Icon } from '../icon';
import { getMethodShortHand } from '../tags/method-tag';
import { type BaseTab, InsomniaTab, TabEnum } from './tab';

export interface OrganizationTabs {
  tabList: BaseTab[];
  activeTabId?: string;
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

  const { changeActiveTab, deleteTabById, deleteAllTabsUnderWorkspace, updateTabById } = useInsomniaTabContext();

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

  const needHandleChange = (changeType: ChangeType, docType: string) => {
    // only handle update and delete
    if (changeType !== 'update' && changeType !== 'remove') {
      return false;
    }
    // only handle the following types
    const list = [
      models.request.type,
      models.grpcRequest.type,
      models.webSocketRequest.type,
      models.requestGroup.type,
      models.unitTestSuite.type,
      models.workspace.type,
      models.environment.type,
      models.mockRoute.type,
    ];
    return list.includes(docType);
  };

  const handleDelete = useCallback((docId: string, docType: string) => {
    if (docType === models.workspace.type) {
      // delete all tabs of this workspace
      deleteAllTabsUnderWorkspace?.(docId);
    } else {
      // delete tab by id
      deleteTabById(docId);
    }
  }, [deleteAllTabsUnderWorkspace, deleteTabById]);

  const haneldUpdate = useCallback((docId: string, newName: string, method?: string, tag?: string) => {
    updateTabById?.(docId, newName, method, tag);
  }, [updateTabById]);

  useEffect(() => {
    // sync tabList with database
    const callback = async (changes: ChangeBufferEvent[]) => {
      console.log('database change', changes);
      for (const change of changes) {
        const changeType = change[0];
        const doc = change[1];

        if (needHandleChange(changeType, doc.type)) {
          if (changeType === 'remove') {
            handleDelete(doc._id, doc.type);
          } else if (changeType === 'update') {
            // currently have 2 types of update, rename and change request method
            if (doc.type === models.request.type) {
              const tag = getMethodShortHand(doc as Request);
              const method = (doc as Request).method;
              haneldUpdate(doc._id, doc.name, method, tag);
            } else {
              haneldUpdate(doc._id, doc.name);
            }
          }
        }
      }
    };
    database.onChange(callback);

    return () => {
      database.offChange(callback);
    };
  }, [deleteTabById, handleDelete, haneldUpdate]);

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
        className={`flex h-[${INSOMNIA_TAB_HEIGHT}] max-w-[calc(100%-50px)] overflow-x-scroll hide-scrollbars`}
        items={tabList}
      >
        {item => <InsomniaTab tab={item} />}
      </GridList>
      <Icon icon="plus" className='ml-[15px] cursor-pointer' />
    </div>
  );
};
