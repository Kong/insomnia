import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';
import EnvironmentsDropdown from '../../containers/EnvironmentsDropdown';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';
import SidebarFilter from './SidebarFilter';
import SyncButton from '../dropdowns/SyncDropdown';
import WorkspaceDropdown from '../../containers/WorkspaceDropdown';
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
      toggleRequestGroup,
      addRequestToRequestGroup,
      addRequestToWorkspace,
      moveRequest,
      moveRequestGroup,
      activateRequest,
      activeRequestId
    } = this.props;

    const filteredChildren = this._filterChildren(
      filter,
      children,
      requestGroup && requestGroup.name
    );

    return filteredChildren.map(child => {
      if (child.doc.type === 'Request') {
        return (
          <SidebarRequestRow
            key={child.doc._id}
            moveRequest={moveRequest}
            activateRequest={activateRequest}
            requestCreate={addRequestToWorkspace}
            isActive={child.doc._id === activeRequestId}
            request={child.doc}
          />
        )
      }

      // We have a RequestGroup!

      const requestGroup = child.doc;
      const isActive = !!child.children.find(c => c.doc._id === activeRequestId);

      const children = this._renderChildren(child.children, requestGroup);

      // Don't render the row if there are no children while filtering
      if (filter && !children.length) {
        return null;
      }

      return (
        <SidebarRequestGroupRow
          key={requestGroup._id}
          isActive={isActive}
          moveRequestGroup={moveRequestGroup}
          moveRequest={moveRequest}
          toggleRequestGroup={toggleRequestGroup}
          addRequestToRequestGroup={() => addRequestToRequestGroup(requestGroup)}
          numChildren={child.children.length}
          requestGroup={requestGroup}>
          {children}
        </SidebarRequestGroupRow>
      )
    })
  }

  render () {
    const {
      showCookiesModal,
      changeFilter,
      filter,
      children,
      hidden,
      requestCreate,
      requestGroupCreate,
      showSyncSettings,
      width,
      workspaceId
    } = this.props;

    return (
      <aside className={classnames('sidebar', {
        'sidebar--hidden': hidden,
        'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
        'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
      })}>
        <WorkspaceDropdown
          className="sidebar__header"
        />

        <div className="sidebar__menu">
          <EnvironmentsDropdown />
          <button className="btn btn--super-compact"
                  onClick={e => showCookiesModal()}>
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

        <SidebarFilter
          onChange={filter => changeFilter(filter)}
          requestCreate={requestCreate}
          requestGroupCreate={requestGroupCreate}
          filter={filter}
        />

        <ul className="sidebar__list sidebar__list-root">
          {this._renderChildren(children)}
        </ul>

        {showSyncSettings ? (
          <div className="sidebar__footer">
            <SyncButton key={workspaceId} workspaceId={workspaceId}/>
          </div>
        ) : null}
      </aside>
    )
  }
}

Sidebar.propTypes = {
  // Functions
  activateRequest: PropTypes.func.isRequired,
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,
  addRequestToWorkspace: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  requestGroupCreate: PropTypes.func.isRequired,
  showEnvironmentsModal: PropTypes.func.isRequired,
  showCookiesModal: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,
  hidden: PropTypes.bool.isRequired,
  showSyncSettings: PropTypes.bool.isRequired,

  // Other
  children: PropTypes.array.isRequired,
  workspaceId: PropTypes.string.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
