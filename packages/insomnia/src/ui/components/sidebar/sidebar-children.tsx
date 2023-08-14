import React, { FC, Fragment } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { isRequestGroup } from '../../../models/request-group';
import { Child, WorkspaceLoaderData } from '../../routes/workspace';
import { SidebarRequestGroupRow } from './sidebar-request-group-row';
import { SidebarRequestRow } from './sidebar-request-row';

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
  const {
    requestTree,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const pinned = requestTree.filter((child: Child) => child.pinned);
  const showSeparator = pinned.length > 0;
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
          rows={requestTree}
        />
      </ul>
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
  const { requestId } = useParams() as { requestId: string };

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
                isActive={hasActiveChild(row.children, requestId)}
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
              isActive={row.doc._id === requestId}
              isPinned={row.pinned}
              disableDragAndDrop={isInPinnedList}
              request={row.doc}
            />
          );
        })}
    </>
  );
};
