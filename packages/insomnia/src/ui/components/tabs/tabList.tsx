import React, { useCallback, useEffect } from 'react';
import { Button, GridList, Menu, MenuItem, MenuTrigger, Popover, type Selection } from 'react-aria-components';
import { useNavigate } from 'react-router-dom';

import { type ChangeBufferEvent, type ChangeType, database } from '../../../common/database';
import * as models from '../../../models/index';
import type { MockRoute } from '../../../models/mock-route';
import type { Request } from '../../../models/request';
import { INSOMNIA_TAB_HEIGHT } from '../../constant';
import { useInsomniaTabContext } from '../../context/app/insomnia-tab-context';
import { Icon } from '../icon';
import { formatMethodName, getRequestMethodShortHand } from '../tags/method-tag';
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

  const { changeActiveTab, deleteTabById, deleteAllTabsUnderWorkspace, deleteAllTabsUnderProject, updateTabById, updateProjectName, updateWorkspaceName } = useInsomniaTabContext();

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
      models.project.type,
    ];
    return list.includes(docType);
  };

  const handleDelete = useCallback((docId: string, docType: string) => {
    if (docType === models.project.type) {
      // delete all tabs of this project
      deleteAllTabsUnderProject?.(docId);
    }
    if (docType === models.workspace.type) {
      // delete all tabs of this workspace
      deleteAllTabsUnderWorkspace?.(docId);
    } else {
      // delete tab by id
      deleteTabById(docId);
    }
  }, [deleteAllTabsUnderProject, deleteAllTabsUnderWorkspace, deleteTabById]);

  const handleUpdate = useCallback((doc: models.BaseModel) => {
    // currently have 2 types of update, rename and change request method
    if (doc.type === models.request.type || doc.type === models.grpcRequest.type || doc.type === models.webSocketRequest.type) {
      const tag = getRequestMethodShortHand(doc as Request);
      const method = (doc as Request).method;
      updateTabById?.(doc._id, doc.name, method, tag);
    } else if (doc.type === models.mockRoute.type) {
      const method = (doc as MockRoute).method;
      const tag = formatMethodName(method);
      updateTabById?.(doc._id, doc.name, method, tag);
    } else if (doc.type === models.project.type) {
      // update project name(for tooltip)
      updateProjectName?.(doc._id, doc.name);
    } else if (doc.type === models.workspace.type) {
      // update workspace name(for tooltip)
      updateWorkspaceName?.(doc._id, doc.name);
    } else {
      updateTabById?.(doc._id, doc.name);
    }
  }, [updateProjectName, updateTabById, updateWorkspaceName]);

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
            handleUpdate(doc);
          }
        }
      }
    };
    database.onChange(callback);

    return () => {
      database.offChange(callback);
    };
  }, [deleteTabById, handleDelete, handleUpdate]);

  if (!tabList.length) {
    return null;
  };

  return (
    <div className={`flex h-[${INSOMNIA_TAB_HEIGHT}px] box-content border-b border-solid border-[--hl-sm]`}>
      <GridList
        aria-label="Insomnia Tabs"
        onSelectionChange={handleSelectionChange}
        selectedKeys={showActiveStatus && activeTabId ? [activeTabId] : []}
        disallowEmptySelection
        defaultSelectedKeys={['req_737492dce0c3460a8a55762e5d1bbd99']}
        selectionMode="single"
        selectionBehavior='replace'
        // Use +1 height to mask the wrapper border, and let the custom element in InsomniaTab act as the fake border.（we need different border for active tab）
        className={`flex h-[${INSOMNIA_TAB_HEIGHT + 1}px] bg-[--color-bg] max-w-[calc(100%-50px)] overflow-x-scroll hide-scrollbars`}
        items={tabList}
      >
        {item => <InsomniaTab tab={item} />}
      </GridList>
      <div className='flex items-center'>
        <MenuTrigger>
          <Button aria-label="Menu">
            <Icon icon="plus" className='ml-[15px] cursor-pointer' />
          </Button>
          <Popover>
            <Menu className='border max-w-lg select-none text-sm border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none'>
              <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={() => { }}>
                save to current workspace
              </MenuItem>
              <MenuItem className="aria-disabled:opacity-30 aria-disabled:cursor-not-allowed flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors" onAction={() => { }}>
                save to other workspace
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </div>
  );
};
