import React, {Component, PropTypes} from 'react';

import Input from '../base/Input';
import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import SidebarRequestRow from './SidebarRequestRow';
import SidebarRequestGroupRow from './SidebarRequestGroupRow';
import WorkspaceDropdown from '../../containers/WorkspaceDropdown';


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
    const {filter, children, requestCreate, requestGroupCreate} = this.props;

    return (
      <aside className="sidebar">
        <header className="sidebar__header">
          <WorkspaceDropdown />
        </header>

        <ul className="sidebar__list">
          {this._renderChildren(children)}
        </ul>

        <footer className="sidebar__footer">
          <Dropdown>
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
          <div className="form-control form-control--underlined">
            <Input
              type="text"
              placeholder="Filter Requests"
              value={filter}
              onChange={this._onFilterChange.bind(this)}
            />
          </div>
        </footer>
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

  // Other
  children: PropTypes.array.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
