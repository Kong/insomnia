import React, { FC, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';

import { GrpcRequest } from '../../../models/grpc-request';
import * as models from '../../../models/index';
import { Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { WebSocketRequest } from '../../../models/websocket-request';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { selectActiveRequest, selectActiveWorkspaceMeta } from '../../redux/selectors';
import { selectSidebarChildren } from '../../redux/sidebar-selectors';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarRequestGroupRow } from './sidebar-request-group-row';
import { SidebarRequestRow } from './sidebar-request-row';

export interface Child {
  doc: Request | GrpcRequest | WebSocketRequest | RequestGroup;
  children: Child[];
  collapsed: boolean;
  hidden: boolean;
  pinned: boolean;
}
export interface SidebarChildObjects {
  pinned: Child[];
  all: Child[];
}

function hasActiveChild(children: Child[], activeRequestId: string): boolean {
  return !!children.find(c => c.doc._id === activeRequestId || hasActiveChild(c.children || [], activeRequestId));
}
interface RecursiveSidebarRowsProps {
  rows: Child[];
  isInPinnedList: boolean;
}

interface Props {
  filter: string;
  handleDuplicateRequest: Function;
}
export const SidebarChildren: FC<Props> = ({
  filter,
  handleDuplicateRequest,
}) => {
  const sidebarChildren = useSelector(selectSidebarChildren);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const setActiveRequest = (requestId: string) => {
    if (activeWorkspaceMeta) {
      models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: requestId });
    }
    updateRequestMetaByParentId(requestId, { lastActive: Date.now() });
  };

  const RecursiveSidebarRows: FC<RecursiveSidebarRowsProps> = ({
    rows,
    isInPinnedList,
  }) => {
    const activeRequest = useSelector(selectActiveRequest);
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';

    return (
      <>
        {rows
          .filter(row => !(!isInPinnedList && row.hidden))
          .map(row => {
            if (isRequestGroup(row.doc)) {
              return (
                <SidebarRequestGroupRow
                  key={row.doc._id}
                  filter={filter || ''}
                  isActive={hasActiveChild(row.children, activeRequestId)}
                  isCollapsed={row.collapsed}
                  requestGroup={row.doc}
                >
                  {row.children.filter(Boolean).length > 0 ? (
                    <RecursiveSidebarRows
                      isInPinnedList={isInPinnedList}
                      rows={row.children}
                    />
                  ) : null}
                </SidebarRequestGroupRow>
              );
            }
            return (
              <SidebarRequestRow
                key={row.doc._id}
                filter={isInPinnedList ? '' : filter || ''}
                handleSetActiveRequest={setActiveRequest}
                handleDuplicateRequest={handleDuplicateRequest}
                isActive={row.doc._id === activeRequestId}
                isPinned={row.pinned}
                disableDragAndDrop={isInPinnedList}
                request={row.doc}
              />
            );
          })}
      </>
    );
  };

  const { all, pinned } = sidebarChildren;
  const showSeparator = sidebarChildren.pinned.length > 0;
  const contextMenuPortal = ReactDOM.createPortal(
    <div className="hide">
      <SidebarCreateDropdown />
    </div>,
    document.querySelector('#dropdowns-container') as any,
  );
  return (
    <Fragment>
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        <RecursiveSidebarRows isInPinnedList={true} rows={pinned} />
      </ul>
      <div className={`sidebar__list-separator${showSeparator ? '' : '--invisible'}`} />
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list"  >
        <RecursiveSidebarRows isInPinnedList={false} rows={all} />
      </ul>
      {contextMenuPortal}
    </Fragment>
  );
};
