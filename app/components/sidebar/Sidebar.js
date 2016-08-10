import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';

import Dropdown from '../base/Dropdown';
import DropdownDivider from '../base/DropdownDivider';
import CookiesModal from '../modals/CookiesModal';
import WorkspaceEnvironmentsEditModal from '../modals/WorkspaceEnvironmentsEditModal';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';
import SidebarFilter from './SidebarFilter';
import WorkspaceDropdown from '../../containers/WorkspaceDropdown';
import {SIDEBAR_SKINNY_REMS} from '../../lib/constants';
import {COLLAPSE_SIDEBAR_REMS} from '../../lib/constants';
import {getModal} from '../modals/index';


class Sidebar extends Component {
  _filterChildren (filter, children, extra = null) {
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
          addRequestToRequestGroup={addRequestToRequestGroup}
          numChildren={child.children.length}
          requestGroup={requestGroup}>
          {children}
        </SidebarRequestGroupRow>
      )
    })
  }

  render () {
    const {
      showEnvironmentsEditModal,
      showCookiesEditModal,
      changeFilter,
      filter,
      children,
      requestCreate,
      requestGroupCreate,
      width
    } = this.props;

    return (
      <aside className={classnames('sidebar', {
        'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
        'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
      })}>
        <WorkspaceDropdown className="sidebar__header"/>
        <div className="sidebar__menu">
          <Dropdown>
            <button className="btn btn--super-compact no-wrap">
              <div className="sidebar__menu__thing">
                <span>{'No Environment'}</span>
                &nbsp;
                <i className="fa fa-caret-down"></i>
              </div>
            </button>
            <ul>
              <DropdownDivider name="Active Environment"/>
              {['Production', 'Staging', 'Development'].map(n => (
                <li key={n}>
                  <button>
                    <i className="fa fa-hand-o-right"></i> Use <strong>{n}</strong>
                  </button>
                </li>
              ))}
              <li>
                <button>
                  <i className="fa fa-empty"></i> No Environment
                </button>
              </li>
              <DropdownDivider name="General"/>
              <li>
                <button onClick={e => showEnvironmentsEditModal()}>
                  <i className="fa fa-wrench"></i> Manage Environments
                </button>
              </li>
            </ul>
          </Dropdown>
          <button className="btn btn--super-compact" onClick={e => showCookiesEditModal()}>
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

      </aside>
    )
  }
}

Sidebar.propTypes = {
  // Functions
  activateRequest: PropTypes.func.isRequired,
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
  moveRequest: PropTypes.func.isRequired,
  moveRequestGroup: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  requestGroupCreate: PropTypes.func.isRequired,
  showEnvironmentsEditModal: PropTypes.func.isRequired,
  showCookiesEditModal: PropTypes.func.isRequired,
  width: PropTypes.number.isRequired,

  // Other
  children: PropTypes.array.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
