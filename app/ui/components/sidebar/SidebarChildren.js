import React, {Component, PropTypes} from 'react';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';


class SidebarChildren extends Component {
  shouldComponentUpdate (nextProps) {
    for (const k of Object.keys(nextProps)) {
      const curr = this.props[k];
      const next = nextProps[k];
      if (curr !== next) {
        console.log('DIFFERENT', k, curr, next);
        return true;
      }
    }

    return false;
  }

  _filterChildren (filter, children, extra = null) {
    filter = filter || '';

    return children.filter(child => {
      if (child.doc.type !== 'Request') {
        return true;
      }

      const request = child.doc;

      const otherMatches = extra || '';
      const toMatch = `${request.method}❅${request.name}❅${otherMatches}`.toLowerCase();
      const matchTokens = filter.toLowerCase().split(' ');

      for (let i = 0; i < matchTokens.length; i++) {
        let token = `${matchTokens[i]}`;
        if (toMatch.indexOf(token) === -1) {
          // Filter failed. Don't render children
          return false;
        }
      }

      return true;
    })
  }

  _renderChildren (children, requestGroup) {
    const {
      filter,
      handleCreateRequest,
      handleCreateRequestGroup,
      handleSetRequestGroupCollapsed,
      moveRequest,
      moveRequestGroup,
      handleActivateRequest,
      activeRequest,
      workspace,
    } = this.props;

    const filteredChildren = this._filterChildren(
      filter,
      children,
      requestGroup && requestGroup.name
    );

    const activeRequestId = activeRequest ? activeRequest._id : 'n/a';

    return filteredChildren.map(child => {
      if (child.doc.type === 'Request') {
        return (
          <SidebarRequestRow
            key={child.doc._id}
            moveRequest={moveRequest}
            handleActivateRequest={handleActivateRequest}
            requestCreate={handleCreateRequest}
            isActive={child.doc._id === activeRequestId}
            request={child.doc}
            workspace={workspace}
          />
        )
      }

      // We have a RequestGroup!

      const requestGroup = child.doc;

      function hasActiveChild (children) {
        for (const c of children) {
          if (c.children.length) {
            return hasActiveChild(c.children);
          } else if (c.doc._id === activeRequestId) {
            return true;
          }
        }

        // Didn't find anything, so return
        return false;
      }

      const isActive = hasActiveChild(child.children);

      const children = this._renderChildren(child.children, requestGroup);

      // Don't render the row if there are no children while filtering
      if (filter && !children.length) {
        return null;
      }

      return (
        <SidebarRequestGroupRow
          handleActivateRequest={handleActivateRequest}
          key={requestGroup._id}
          isActive={isActive}
          moveRequestGroup={moveRequestGroup}
          moveRequest={moveRequest}
          handleSetRequestGroupCollapsed={handleSetRequestGroupCollapsed}
          isCollapsed={child.collapsed}
          handleCreateRequest={handleCreateRequest}
          handleCreateRequestGroup={handleCreateRequestGroup}
          numChildren={child.children.length}
          workspace={workspace}
          requestGroup={requestGroup}
          children={children}
        />
      )
    })
  }

  render () {
    const {children} = this.props;

    return (
      <ul className="sidebar__list sidebar__list-root">
        {this._renderChildren(children)}
      </ul>
    )
  }
}

SidebarChildren.propTypes = {
  // Required
  handleActivateRequest: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  children: PropTypes.arrayOf(PropTypes.object).isRequired,
  filter: PropTypes.string.isRequired,
  workspace: PropTypes.object.isRequired,

  // Optional
  activeRequest: PropTypes.object,
};

export default SidebarChildren;
