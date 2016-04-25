import React, {Component, PropTypes} from 'react'
import WorkspaceDropdown from './../containers/WorkspaceDropdown'
import DebouncingInput from './base/DebouncingInput'
import SidebarRequestGroupRow from './SidebarRequestGroupRow'
import SidebarRequestRow from './SidebarRequestRow'

class Sidebar extends Component {
  onFilterChange (value) {
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
    const {filter} = this.props;

    const filteredChildren = this._filterChildren(
      filter,
      children,
      requestGroup && requestGroup.name
    ).sort((a, b) => a.doc._id > b.doc._id ? -1 : 1);

    return filteredChildren.map(child => {
      if (child.doc.type === 'Request') {
        return (
          <SidebarRequestRow
            key={child.doc._id}
            activateRequest={this.props.activateRequest}
            isActive={child.doc._id === this.props.activeRequestId}
            request={child.doc}
          />
        )
      } else if (child.doc.type === 'RequestGroup') {
        const requestGroup = child.doc;
        const isActive = !!child.children.find(c => c.doc._id === this.props.activeRequestId);

        return (
          <SidebarRequestGroupRow
            key={requestGroup._id}
            isActive={isActive}
            toggleRequestGroup={this.props.toggleRequestGroup}
            addRequestToRequestGroup={this.props.addRequestToRequestGroup}
            numChildren={child.children.length}
            requestGroup={requestGroup}
          >
            {this._renderChildren(child.children, requestGroup)}
          </SidebarRequestGroupRow>
        )
      } else {
        console.error('Unknown child type', child.doc.type);
        return null;
      }
    })
  }

  render () {
    const {filter, children} = this.props;

    return (
      <section className="sidebar bg-dark grid--v section section--bordered">
        <header className="header bg-brand section__header">
          <WorkspaceDropdown />
        </header>
        <div className="grid--v grid--start grid__cell section__body">
          <ul
            className="grid--v grid--start grid__cell sidebar__scroll hover-scrollbars sidebar__request-list">
            {this._renderChildren(children)}
          </ul>
          <div className="grid grid--center">
            <div className="grid__cell form-control form-control--underlined">
              <DebouncingInput
                type="text"
                placeholder="Filter Items"
                debounceMillis={300}
                value={filter}
                onChange={this.onFilterChange.bind(this)}/>
            </div>
          </div>
        </div>
      </section>
    )
  }
}

Sidebar.propTypes = {
  // Functions
  activateRequest: PropTypes.func.isRequired,
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,

  // Other
  children: PropTypes.array.isRequired,
  workspaceId: PropTypes.string.isRequired,

  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
