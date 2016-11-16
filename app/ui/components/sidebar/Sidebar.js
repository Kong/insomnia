import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import EnvironmentsDropdown from '../dropdowns/EnvironmentsDropdown';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';
import SidebarFilter from './SidebarFilter';
import SyncButton from '../dropdowns/SyncDropdown';
import WorkspaceDropdown from '../dropdowns/WorkspaceDropdown';
import {
  SIDEBAR_SKINNY_REMS,
  COLLAPSE_SIDEBAR_REMS
} from '../../../common/constants';


class Sidebar extends Component {
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
            requestCreate={handleCreateRequest.bind(null, workspace._id)}
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
          handleCreateRequest={handleCreateRequest.bind(null, requestGroup._id)}
          numChildren={child.children.length}
          workspace={workspace}
          requestGroup={requestGroup}
          children={children}
        />
      )
    })
  }

  render () {
    const {
      showCookiesModal,
      filter,
      children,
      hidden,
      handleCreateRequest,
      handleCreateRequestGroup,
      width,
      workspace,
      workspaces,
      environments,
      activeEnvironment,
      handleSetActiveEnvironment,
      handleSetActiveWorkspace,
      handleImportFile,
      handleExportFile,
      handleChangeFilter,
      isLoading,
    } = this.props;

    return (
      <aside className={classnames('sidebar', {
        'sidebar--hidden': hidden,
        'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
        'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
      })}>
        <WorkspaceDropdown
          className="sidebar__header"
          activeWorkspace={workspace}
          workspaces={workspaces}
          handleExportFile={handleExportFile}
          handleImportFile={handleImportFile}
          handleSetActiveWorkspace={handleSetActiveWorkspace}
          isLoading={isLoading}
        />

        <div className="sidebar__menu">
          <EnvironmentsDropdown
            handleChangeEnvironment={id => handleSetActiveEnvironment(workspace._id, id)}
            activeEnvironment={activeEnvironment}
            environments={environments}
            workspace={workspace}
          />
          <button className="btn btn--super-compact"
                  onClick={e => showCookiesModal()}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          onChange={filter => handleChangeFilter(filter)}
          requestCreate={handleCreateRequest.bind(null, workspace._id)}
          requestGroupCreate={handleCreateRequestGroup.bind(null, workspace._id)}
          filter={filter}
        />

        <ul className="sidebar__list sidebar__list-root">
          {this._renderChildren(children)}
        </ul>

        <SyncButton
          className="sidebar__footer"
          key={workspace._id}
          workspace={workspace}
        />
      </aside>
    )
  }
}

Sidebar.propTypes = {
  // Functions
  handleActivateRequest: PropTypes.func.isRequired,
  handleSetRequestGroupCollapsed: PropTypes.func.isRequired,
  handleChangeFilter: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleExportFile: PropTypes.func.isRequired,
  handleSetActiveWorkspace: PropTypes.func.isRequired,
  handleSetActiveEnvironment: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  handleCreateRequest: PropTypes.func.isRequired,
  handleCreateRequestGroup: PropTypes.func.isRequired,
  showEnvironmentsModal: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,

  // Other
  hidden: PropTypes.bool.isRequired,
  width: PropTypes.number.isRequired,
  isLoading: PropTypes.bool.isRequired,
  children: PropTypes.array.isRequired,
  workspace: PropTypes.object.isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired,
  environments: PropTypes.arrayOf(PropTypes.object).isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequest: PropTypes.object,
  activeEnvironment: PropTypes.object,
};

export default Sidebar;
