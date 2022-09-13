import React, { FC, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';

import { GrpcRequest } from '../../../models/grpc-request';
import { Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { WebSocketRequest } from '../../../models/websocket-request';
import { selectActiveRequest } from '../../redux/selectors';
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

interface Props {
  filter: string;
}
export const SidebarChildren: FC<Props> = ({
  filter,
}) => {
  const sidebarChildren = useSelector(selectSidebarChildren);

  const { all, pinned } = sidebarChildren;
  const showSeparator = sidebarChildren.pinned.length > 0;
  const contextMenuPortal = ReactDOM.createPortal(
    <div className="hide">
      <SidebarCreateDropdown />
    </div>,
    document.querySelector('#dropdowns-container') as any
  );
  return (
    <Fragment>
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        <RecursiveSidebarRows
          filter={filter}
          isInPinnedList={true}
          rows={pinned}
        />
      </ul>
      <div
        className={`sidebar__list-separator${
          showSeparator ? '' : '--invisible'
        }`}
      />
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        <RecursiveSidebarRows
          filter={filter}
          isInPinnedList={false}
          rows={all}
        />
      </ul>
      {contextMenuPortal}
    </Fragment>
  );
};

interface RecursiveSidebarRowsProps {
  rows: Child[];
  isInPinnedList: boolean;
  filter: string;
}

const RecursiveSidebarRows = ({
  rows,
  isInPinnedList,
  filter,
}: RecursiveSidebarRowsProps) => {
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
                    filter={filter}
                  />
                ) : null}
              </SidebarRequestGroupRow>
            );
          }
          return (
            <SidebarRequestRow
              key={row.doc._id}
              filter={isInPinnedList ? '' : filter || ''}
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
