import React, { FC, Fragment } from 'react';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';

import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { selectActiveRequest } from '../../redux/selectors';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarRequestGroupRow } from './sidebar-request-group-row';
import { SidebarRequestRow } from './sidebar-request-row';

export interface Child {
  doc: Request | GrpcRequest | RequestGroup;
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
  childObjects: SidebarChildObjects;
  filter: string;
  handleActivateRequest: Function;
  handleCopyAsCurl: Function;
  handleDuplicateRequest: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleGenerateCode: Function;
  handleSetRequestGroupCollapsed: Function;
  handleSetRequestPinned: Function;
}
export const SidebarChildren: FC<Props> = ({
  childObjects,
  filter,
  handleActivateRequest,
  handleCopyAsCurl,
  handleDuplicateRequest,
  handleDuplicateRequestGroup,
  handleGenerateCode,
  handleSetRequestGroupCollapsed,
  handleSetRequestPinned,
}) => {
  const RecursiveSidebarRows: FC<RecursiveSidebarRowsProps> = ({ rows, isInPinnedList }) => {
    const activeRequest = useSelector(selectActiveRequest);
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    return (
      <>
        {rows.map(row => (!isInPinnedList && row.hidden)
          ? null
          : (isRequest(row.doc) || isGrpcRequest(row.doc))
            ? (
              <SidebarRequestRow
                key={row.doc._id}
                filter={isInPinnedList ? '' : filter || ''}
                handleActivateRequest={handleActivateRequest}
                handleSetRequestPinned={handleSetRequestPinned}
                handleDuplicateRequest={handleDuplicateRequest}
                handleGenerateCode={handleGenerateCode}
                handleCopyAsCurl={handleCopyAsCurl}
                isActive={row.doc._id === activeRequestId}
                isPinned={row.pinned}
                disableDragAndDrop={isInPinnedList}
                request={row.doc}
              />
            ) : (
              <SidebarRequestGroupRow
                key={row.doc._id}
                filter={filter || ''}
                isActive={hasActiveChild(row.children, activeRequestId)}
                handleActivateRequest={handleActivateRequest}
                handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
                handleDuplicateRequestGroup={handleDuplicateRequestGroup}
                isCollapsed={row.collapsed}
                requestGroup={row.doc}
              >
                {row.children.filter(Boolean).length > 0 ? <RecursiveSidebarRows isInPinnedList={isInPinnedList} rows={row.children} /> : null}
              </SidebarRequestGroupRow>
            ))}
      </>);
  };
  const { all, pinned } = childObjects;
  const showSeparator = childObjects.pinned.length > 0;
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
