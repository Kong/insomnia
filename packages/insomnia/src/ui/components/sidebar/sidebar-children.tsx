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
interface SharedProps {
  handleActivateRequest: Function;
  handleSetRequestPinned: Function;
  handleSetRequestGroupCollapsed: Function;
  handleDuplicateRequest: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  filter: string;
  hotKeyRegistry: HotKeyRegistry;
}
function hasActiveChild(children: Child[], activeRequestId: string): boolean {
  return !!children.find(c => c.doc._id === activeRequestId || hasActiveChild(c.children || [], activeRequestId));
}
interface RecursiveSidebarRowsProps extends SharedProps {
  children: Child[];
  isInPinnedList: boolean;
}
const RecursiveSidebarRows: FC<RecursiveSidebarRowsProps> = ({
  children,
  isInPinnedList,
  filter,
  handleSetRequestPinned,
  handleSetRequestGroupCollapsed,
  handleDuplicateRequest,
  handleDuplicateRequestGroup,
  handleGenerateCode,
  handleCopyAsCurl,
  handleActivateRequest,
  hotKeyRegistry,
}) => {
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
                filter={filter}
                handleSetRequestPinned={handleSetRequestPinned}
                handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
                handleDuplicateRequest={handleDuplicateRequest}
                handleDuplicateRequestGroup={handleDuplicateRequestGroup}
                handleGenerateCode={handleGenerateCode}
                handleCopyAsCurl={handleCopyAsCurl}
                handleActivateRequest={handleActivateRequest}
                hotKeyRegistry={hotKeyRegistry}
              >
                {child.children}
              </RecursiveSidebarRows>
            </SidebarRequestGroupRow>
          ))}
    </>);
};
interface Props extends SharedProps {
  childObjects: SidebarChildObjects;
}
export const SidebarChildren: FC<Props> = ({
  filter,
  handleSetRequestPinned,
  handleSetRequestGroupCollapsed,
  handleDuplicateRequest,
  handleDuplicateRequestGroup,
  handleGenerateCode,
  handleCopyAsCurl,
  handleActivateRequest,
  childObjects,
  hotKeyRegistry,
}) => {
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
          filter={filter}
          handleSetRequestPinned={handleSetRequestPinned}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleDuplicateRequest={handleDuplicateRequest}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleGenerateCode={handleGenerateCode}
          handleCopyAsCurl={handleCopyAsCurl}
          handleActivateRequest={handleActivateRequest}
          hotKeyRegistry={hotKeyRegistry}
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
          filter={filter}
          handleSetRequestPinned={handleSetRequestPinned}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleDuplicateRequest={handleDuplicateRequest}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleGenerateCode={handleGenerateCode}
          handleCopyAsCurl={handleCopyAsCurl}
          handleActivateRequest={handleActivateRequest}
          hotKeyRegistry={hotKeyRegistry}
        >
          {all}
        </RecursiveSidebarRows>
      </ul>
      {contextMenuPortal}
    </Fragment>
  );
};
