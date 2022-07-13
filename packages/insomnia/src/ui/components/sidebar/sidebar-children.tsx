import { HotKeyRegistry } from 'insomnia-common';
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
  children: Child[];
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
  hotKeyRegistry: HotKeyRegistry;
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
  hotKeyRegistry,
}) => {
  const RecursiveSidebarRows: FC<RecursiveSidebarRowsProps> = ({ children, isInPinnedList }) => {
    const activeRequest = useSelector(selectActiveRequest);
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    return (
      <>
        {children.map(child => (!isInPinnedList && child.hidden)
          ? null
          : (isRequest(child.doc) || isGrpcRequest(child.doc))
            ? (
              <SidebarRequestRow
                key={child.doc._id}
                filter={isInPinnedList ? '' : filter || ''}
                handleActivateRequest={handleActivateRequest}
                handleSetRequestPinned={handleSetRequestPinned}
                handleDuplicateRequest={handleDuplicateRequest}
                handleGenerateCode={handleGenerateCode}
                handleCopyAsCurl={handleCopyAsCurl}
                isActive={child.doc._id === activeRequestId}
                isPinned={child.pinned}
                disableDragAndDrop={isInPinnedList}
                request={child.doc}
                hotKeyRegistry={hotKeyRegistry} // Necessary for plugin actions on requests
              />
            ) : (
              <SidebarRequestGroupRow
                key={child.doc._id}
                filter={filter || ''}
                isActive={hasActiveChild(child.children, activeRequestId)}
                handleActivateRequest={handleActivateRequest}
                handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
                handleDuplicateRequestGroup={handleDuplicateRequestGroup}
                isCollapsed={child.collapsed}
                requestGroup={child.doc}
                hotKeyRegistry={hotKeyRegistry}
              >
                <RecursiveSidebarRows
                  isInPinnedList={isInPinnedList}
                >
                  {child.children}
                </RecursiveSidebarRows>
              </SidebarRequestGroupRow>
            ))}
      </>);
  };
  const { all, pinned } = childObjects;
  const showSeparator = childObjects.pinned.length > 0;
  const contextMenuPortal = ReactDOM.createPortal(
    <div className="hide">
      <SidebarCreateDropdown
        hotKeyRegistry={hotKeyRegistry}
      />
    </div>,
    document.querySelector('#dropdowns-container') as any,
  );
  return (
    <Fragment>
      <ul
        className="sidebar__list sidebar__list-root theme--sidebar__list"
      >
        <RecursiveSidebarRows
          isInPinnedList={true}
        >
          {pinned}
        </RecursiveSidebarRows>
      </ul>
      <div className={`sidebar__list-separator${showSeparator ? '' : '--invisible'}`} />
      <ul
        className="sidebar__list sidebar__list-root theme--sidebar__list"
      >
        <RecursiveSidebarRows
          isInPinnedList={false}
        >
          {all}
        </RecursiveSidebarRows>
      </ul>
      {contextMenuPortal}
    </Fragment>
  );
};
