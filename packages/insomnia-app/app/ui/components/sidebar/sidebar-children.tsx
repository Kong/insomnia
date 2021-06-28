import React, { Fragment, PureComponent } from 'react';
import ReactDOM from 'react-dom';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import SidebarRequestRow from './sidebar-request-row';
import SidebarRequestGroupRow from './sidebar-request-group-row';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import { isRequest, Request } from '../../../models/request';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Environment } from '../../../models/environment';
import SidebarCreateDropdown from './sidebar-create-dropdown';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { HandleRender } from '../../../common/render';

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
interface Props {
  handleActivateRequest: Function;
  handleCreateRequest: (id: string) => any;
  handleCreateRequestGroup: (parentId: string) => void;
  handleSetRequestPinned: Function;
  handleSetRequestGroupCollapsed: Function;
  handleDuplicateRequest: Function;
  handleDuplicateRequestGroup: (requestGroup: RequestGroup) => any;
  handleGenerateCode: Function;
  handleCopyAsCurl: Function;
  handleRender: HandleRender;
  moveDoc: Function;
  childObjects: SidebarChildObjects;
  workspace: Workspace;
  filter: string;
  hotKeyRegistry: HotKeyRegistry;
  activeEnvironment?: Environment | null;
  activeRequest?: Request | GrpcRequest | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SidebarChildren extends PureComponent<Props> {
  _contextMenu: SidebarCreateDropdown | null = null;

  _handleContextMenu(e: React.MouseEvent<HTMLUListElement>) {
    const { target, currentTarget, clientX, clientY } = e;

    if (target !== currentTarget) {
      return;
    }

    e.preventDefault();
    const menu = this._contextMenu;

    if (menu && document.body) {
      const x = clientX;
      const y = document.body.getBoundingClientRect().height - clientY;
      menu.show({
        x,
        y,
      });
    }
  }

  _setContextMenuRef(n: SidebarCreateDropdown) {
    this._contextMenu = n;
  }

  _renderChildren(children: Child[], isInPinnedList: boolean) {
    const {
      filter,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleSetRequestPinned,
      handleSetRequestGroupCollapsed,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleGenerateCode,
      handleCopyAsCurl,
      handleRender,
      moveDoc,
      handleActivateRequest,
      activeRequest,
      workspace,
      hotKeyRegistry,
      activeEnvironment,
    } = this.props;
    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
    return children.map(child => {
      if (!isInPinnedList && child.hidden) {
        return null;
      }

      if (isRequest(child.doc) || isGrpcRequest(child.doc)) {
        return (
          <SidebarRequestRow
            key={child.doc._id}
            filter={isInPinnedList ? '' : filter || ''}
            moveDoc={moveDoc}
            handleActivateRequest={handleActivateRequest}
            handleSetRequestPinned={handleSetRequestPinned}
            handleDuplicateRequest={handleDuplicateRequest}
            handleGenerateCode={handleGenerateCode}
            handleCopyAsCurl={handleCopyAsCurl}
            handleRender={handleRender}
            requestCreate={handleCreateRequest}
            isActive={child.doc._id === activeRequestId}
            isPinned={child.pinned}
            disableDragAndDrop={isInPinnedList}
            request={child.doc}
            hotKeyRegistry={hotKeyRegistry} // Necessary for plugin actions on requests
            activeEnvironment={activeEnvironment}
          />
        );
      }

      // We have a RequestGroup!
      const requestGroup = child.doc;

      function hasActiveChild(children) {
        for (const c of children) {
          if (hasActiveChild(c.children || [])) {
            return true;
          } else if (c.doc._id === activeRequestId) {
            return true;
          }
        }

        // Didn't find anything, so return
        return false;
      }

      const isActive = hasActiveChild(child.children);

      const children = this._renderChildren(child.children, isInPinnedList);

      return (
        <SidebarRequestGroupRow
          key={requestGroup._id}
          filter={filter || ''}
          isActive={isActive}
          moveDoc={moveDoc}
          handleActivateRequest={handleActivateRequest}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleRender={handleRender}
          isCollapsed={child.collapsed}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          workspace={workspace}
          requestGroup={requestGroup}
          hotKeyRegistry={hotKeyRegistry}
          activeEnvironment={activeEnvironment}
        >
          {children}
        </SidebarRequestGroupRow>
      );
    });
  }

  _renderList(children: Child[], pinnedList: boolean) {
    return (
      <ul
        className="sidebar__list sidebar__list-root theme--sidebar__list"
        onContextMenu={this._handleContextMenu}>
        {this._renderChildren(children, pinnedList)}
      </ul>
    );
  }

  _handleCreateRequest() {
    const { handleCreateRequest, workspace } = this.props;
    handleCreateRequest(workspace._id);
  }

  _handleCreateRequestGroup() {
    const { handleCreateRequestGroup, workspace } = this.props;
    handleCreateRequestGroup(workspace._id);
  }

  render() {
    const { childObjects, hotKeyRegistry } = this.props;
    const showSeparator = childObjects.pinned.length > 0;
    const contextMenuPortal = ReactDOM.createPortal(
      <div className="hide">
        <SidebarCreateDropdown
          ref={this._setContextMenuRef}
          handleCreateRequest={this._handleCreateRequest}
          handleCreateRequestGroup={this._handleCreateRequestGroup}
          hotKeyRegistry={hotKeyRegistry}
        />
      </div>,
      document.querySelector('#dropdowns-container') as any,
    );
    return (
      <Fragment>
        {this._renderList(childObjects.pinned, true)}
        <div className={`sidebar__list-separator${showSeparator ? '' : '--invisible'}`} />
        {this._renderList(childObjects.all, false)}
        {contextMenuPortal}
      </Fragment>
    );
  }
}

export default SidebarChildren;
