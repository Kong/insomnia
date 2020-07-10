// @flow
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import SidebarRequestRow from './sidebar-request-row';
import SidebarRequestGroupRow from './sidebar-request-group-row';
import * as models from '../../../models/index';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import type { Request } from '../../../models/request';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import type { Environment } from '../../../models/environment';
import { Dropdown } from '../base/dropdown';
import SidebarCreateDropdown from './sidebar-create-dropdown';

type Child = {
  doc: Request | RequestGroup,
  children: Array<Child>,
  collapsed: boolean,
  hidden: boolean,
  pinned: boolean,
};

export type SidebarChildObjects = {
  pinned: Array<Child>,
  all: Array<Child>,
};

type Props = {
  // Required
  handleActivateRequest: Function,
  handleCreateRequest: Function,
  handleCreateRequestGroup: Function,
  handleSetRequestPinned: Function,
  handleSetRequestGroupCollapsed: Function,
  handleDuplicateRequest: Function,
  handleDuplicateRequestGroup: Function,
  handleMoveRequestGroup: Function,
  handleGenerateCode: Function,
  handleCopyAsCurl: Function,
  handleRender: Function,
  moveDoc: Function,
  childObjects: SidebarChildObjects,
  workspace: Workspace,
  filter: string,
  hotKeyRegistry: HotKeyRegistry,
  activeEnvironment: Environment | null,

  // Optional
  activeRequest: ?Request,
};

@autobind
class SidebarChildren extends React.PureComponent<Props> {
  _contextMenu: ?SidebarCreateDropdown;

  _handleContextMenu(e: MouseEvent) {
    const { target, currentTarget, clientX, clientY } = e;

    if (target !== currentTarget) {
      return;
    }

    e.preventDefault();

    const menu = this._contextMenu;
    if (menu && document.body) {
      const x = clientX;
      const y = document.body.getBoundingClientRect().height - clientY;
      menu.show({ x, y });
    }
  }

  _setContextMenuRef(n: ?Dropdown) {
    this._contextMenu = n;
  }

  _renderChildren(children: Array<Child>, isInPinnedList: boolean): React.Node {
    const {
      filter,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleSetRequestPinned,
      handleSetRequestGroupCollapsed,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleMoveRequestGroup,
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

      if (child.doc.type === models.request.type) {
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
            workspace={workspace}
            hotKeyRegistry={hotKeyRegistry}
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
          handleMoveRequestGroup={handleMoveRequestGroup}
          handleRender={handleRender}
          isCollapsed={child.collapsed}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          numChildren={child.children.length}
          workspace={workspace}
          requestGroup={requestGroup}
          hotKeyRegistry={hotKeyRegistry}
          children={children}
          activeEnvironment={activeEnvironment}
        />
      );
    });
  }

  _renderList(children: Array<Child>, pinnedList: boolean): React.Node {
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
      (document.querySelector('#dropdowns-container'): any),
    );

    return (
      <React.Fragment>
        {this._renderList(childObjects.pinned, true)}
        <div className={`sidebar__list-separator${showSeparator ? '' : '--invisible'}`} />
        {this._renderList(childObjects.all, false)}
        {contextMenuPortal}
      </React.Fragment>
    );
  }
}

export default SidebarChildren;
