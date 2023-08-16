import React, { FC, useRef } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { SortOrder } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { sortMethodMap } from '../../../common/sorting';
import * as models from '../../../models';
import { isRequestGroup } from '../../../models/request-group';
import { useWorkspaceMetaPatcher } from '../../hooks/use-request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarSortDropdown } from './sidebar-sort-dropdown';
interface Props {
  filter: string;
}

export const SidebarFilter: FC<Props> = ({ filter }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const updateMeta = useWorkspaceMetaPatcher();
  const {
    activeWorkspace,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  const handleClearFilter = () => {
    updateMeta(activeWorkspace._id, { sidebarFilter: '' });
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  };

  const handleOnChange = async (event: React.SyntheticEvent<HTMLInputElement>) => {
    updateMeta(activeWorkspace._id, { sidebarFilter: event.currentTarget.value });
  };

  useDocBodyKeyboardShortcuts({
    sidebar_focusFilter: () => {
      inputRef.current?.focus();
    },
  });

  const sortSidebar = async (order: SortOrder, parentId?: string) => {
    let flushId: number | undefined;
    if (!parentId) {
      parentId = activeWorkspace._id;
      flushId = await db.bufferChanges();
    }
    const docs = [
      ...(await models.requestGroup.findByParentId(parentId)),
      ...(await models.request.findByParentId(parentId)),
      ...(await models.grpcRequest.findByParentId(parentId)),
      ...(await models.webSocketRequest.findByParentId(parentId)),
    ].sort(sortMethodMap[order]);
    // @ts-expect-error -- TSCONVERSION the fetched model will only ever be a RequestGroup, Request, or GrpcRequest
    // Which all have the .update method. How do we better filter types?
    await Promise.all(docs.map((doc, i) => models.getModel(doc.type)?.update(doc, { metaSortKey: i * 100 })));
    // sort RequestGroups recursively
    await Promise.all(docs.filter(isRequestGroup).map(g => sortSidebar(order, g._id)));

    if (flushId) {
      await db.flushChanges(flushId);
    }
  };
  const dataTestId = 'SidebarFilter';
  return (
    <div className="sidebar__filter" data-testid={dataTestId}>
      <div className="form-control form-control--outlined form-control--btn-right">
        <input
          ref={inputRef}
          type="text"
          placeholder="Filter"
          defaultValue={filter}
          onChange={handleOnChange}
        />
        {filter && (
          <button className="form-control__right" onClick={handleClearFilter}>
            <i className="fa fa-times-circle" />
          </button>
        )}
      </div>
      <SidebarSortDropdown handleSort={sortSidebar} />
      <SidebarCreateDropdown />
    </div>
  );
};
