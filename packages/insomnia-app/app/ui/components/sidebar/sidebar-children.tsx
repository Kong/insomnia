import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { HotKeyRegistry } from 'insomnia-common';
import React, { Fragment, PureComponent } from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleRender } from '../../../common/render';
import { GrpcRequest, isGrpcRequest } from '../../../models/grpc-request';
import { isRequest, Request } from '../../../models/request';
import type { RequestGroup } from '../../../models/request-group';
import { RootState } from '../../redux/modules';
import { selectActiveRequest, selectActiveWorkspace } from '../../redux/selectors';
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

type ReduxProps = ReturnType<typeof mapStateToProps>;

const mapStateToProps = (state: RootState) => ({
  activeRequest: selectActiveRequest(state),
  workspace: selectActiveWorkspace(state),
});

interface Props extends ReduxProps {
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
  childObjects: SidebarChildObjects;
  filter: string;
  hotKeyRegistry: HotKeyRegistry;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class UnconnectedSidebarChildren extends PureComponent<Props> {
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
      handleActivateRequest,
      activeRequest,
      hotKeyRegistry,
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
          handleActivateRequest={handleActivateRequest}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleRender={handleRender}
          isCollapsed={child.collapsed}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          requestGroup={requestGroup}
          hotKeyRegistry={hotKeyRegistry}
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
        onContextMenu={this._handleContextMenu}
      >
        {this._renderChildren(children, pinnedList)}
      </ul>
    );
  }

  _handleCreateRequest() {
    const { handleCreateRequest, workspace } = this.props;
    if (workspace) {
      handleCreateRequest(workspace._id);
    }
  }

  _handleCreateRequestGroup() {
    const { handleCreateRequestGroup, workspace } = this.props;
    if (workspace) {
      handleCreateRequestGroup(workspace._id);
    }
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

export const SidebarChildren = connect(mapStateToProps)(UnconnectedSidebarChildren);
