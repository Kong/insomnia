// @flow
import * as React from 'react';
import SidebarRequestRow from './sidebar-request-row';
import SidebarRequestGroupRow from './sidebar-request-group-row';
import * as models from '../../../models/index';
import * as misc from '../../../common/misc';
import type { RequestGroup } from '../../../models/request-group';
import type { Workspace } from '../../../models/workspace';
import type { Request } from '../../../models/request';
import type { HotKeyRegistry } from '../../../common/hotkeys';

type Child = {
  doc: Request | RequestGroup,
  children: Array<Child>,
  collapsed: boolean,
  hidden: boolean,
  pinned: Boolean,
};

type Props = {
  // Required
  handleActivateRequest: Function,
  handleCreateRequest: Function,
  handleCreateRequestGroup: Function,
  handleSetRequestPinned: Function,
  handleSetRequestGroupPinned: Function,
  handleSetRequestGroupCollapsed: Function,
  handleDuplicateRequest: Function,
  handleDuplicateRequestGroup: Function,
  handleMoveRequestGroup: Function,
  handleGenerateCode: Function,
  handleCopyAsCurl: Function,
  moveDoc: Function,
  childObjects: Array<Child>,
  workspace: Workspace,
  filter: string,
  hotKeyRegistry: HotKeyRegistry,

  // Optional
  activeRequest?: Request,
};

class SidebarChildren extends React.PureComponent<Props> {
  _renderChildren(children: Array<Child>, pinnable: boolean): React.Node {
    const {
      filter,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleSetRequestPinned,
      handleSetRequestGroupPinned,
      handleSetRequestGroupCollapsed,
      handleDuplicateRequest,
      handleDuplicateRequestGroup,
      handleMoveRequestGroup,
      handleGenerateCode,
      handleCopyAsCurl,
      moveDoc,
      handleActivateRequest,
      activeRequest,
      workspace,
      hotKeyRegistry,
    } = this.props;

    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';

    return children.map(child => {
      if (child.hidden) {
        return null;
      }

      if (child.doc.type === models.request.type) {
        return (
          <SidebarRequestRow
            key={child.doc._id}
            filter={filter || ''}
            moveDoc={moveDoc}
            handleActivateRequest={handleActivateRequest}
            handleSetRequestPinned={pinnable ? handleSetRequestPinned : misc.nullFn}
            handleDuplicateRequest={handleDuplicateRequest}
            handleGenerateCode={handleGenerateCode}
            handleCopyAsCurl={handleCopyAsCurl}
            requestCreate={handleCreateRequest}
            isActive={child.doc._id === activeRequestId}
            isPinned={pinnable && child.pinned}
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
      const children = this._renderChildren(child.children, false); // False because only top level items can be pinned

      return (
        <SidebarRequestGroupRow
          key={requestGroup._id}
          filter={filter || ''}
          isActive={isActive}
          moveDoc={moveDoc}
          handleActivateRequest={handleActivateRequest}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          handleSetRequestGroupPinned={pinnable ? handleSetRequestGroupPinned : misc.nullFn}
          handleDuplicateRequestGroup={handleDuplicateRequestGroup}
          handleMoveRequestGroup={handleMoveRequestGroup}
          isCollapsed={child.collapsed}
          isPinned={pinnable && child.pinned}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          numChildren={child.children.length}
          workspace={workspace}
          requestGroup={requestGroup}
          hotKeyRegistry={hotKeyRegistry}
          children={children}
        />
      );
    });
  }

  render() {
    const { childObjects } = this.props;

    const pinnedChildren = childObjects.filter(c => c.pinned);
    const unpinnedChildren = childObjects.filter(c => !c.pinned);

    return (
      <React.Fragment>
        {pinnedChildren && pinnedChildren.length > 0 && (
          <ul className="sidebar__list sidebar__list-root theme--sidebar__list sidebar__list--pinned">
            {this._renderChildren(pinnedChildren, true)}
          </ul>
        )}
        {unpinnedChildren && unpinnedChildren.length > 0 && (
          <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
            {this._renderChildren(unpinnedChildren, true)}
          </ul>
        )}
      </React.Fragment>
    );
  }
}

export default SidebarChildren;
