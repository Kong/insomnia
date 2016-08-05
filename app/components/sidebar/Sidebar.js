import React, {Component, PropTypes} from 'react';
import classnames from 'classnames';

import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';
import WorkspaceDropdown from '../../containers/WorkspaceDropdown';
import {SIDEBAR_SKINNY_REMS} from '../../lib/constants';
import {COLLAPSE_SIDEBAR_REMS} from '../../lib/constants';


class Sidebar extends Component {
  _onFilterChange (value) {
    this.props.changeFilter(value);
  }

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
    const {filter, children, requestCreate, requestGroupCreate, width} = this.props;

    return (
      <aside className={classnames('sidebar', {
        'sidebar--skinny': width < SIDEBAR_SKINNY_REMS,
        'sidebar--collapsed': width < COLLAPSE_SIDEBAR_REMS
      })}>
        <WorkspaceDropdown className="sidebar__header"/>

        <div className="sidebar__filter">
          <div className="form-control form-control--outlined">
            <input
              type="text"
              placeholder="Filter"
              value={filter}
              onChange={e => this._onFilterChange(e.target.value)}
            />
          </div>
          <Dropdown right={true}>
            <button className="btn btn--compact">
              <i className="fa fa-plus-circle"></i>
            </button>
            <ul>
              <li>
                <button onClick={e => requestCreate()}>
                  <i className="fa fa-plus-circle"></i> New Request
                  <DropdownHint char="N"></DropdownHint>
                </button>
              </li>
              <li>
                <button onClick={e => requestGroupCreate()}>
                  <i className="fa fa-folder"></i> New Folder
                </button>
              </li>
            </ul>
          </Dropdown>
        </div>
        <div className="sidebar__menu">
          <Dropdown>
            <button className="btn btn--super-compact no-wrap">
              <div className="sidebar__menu__thing">
                <span>{'Production'}</span>
                &nbsp;
                <i className="fa fa-caret-down"></i>
              </div>
            </button>
            <ul>
              <li>
                <button>Production</button>
              </li>
              <li>
                <button>Staging</button>
              </li>
              <li>
                <button>Development</button>
              </li>
            </ul>
          </Dropdown>
          <button className="btn btn--super-compact">
            <div className="sidebar__menu__thing">
              <span>Cookies</span>
            </div>
          </button>
        </div>

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
  width: PropTypes.number.isRequired,

  // Other
  children: PropTypes.array.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
