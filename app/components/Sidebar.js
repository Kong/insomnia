import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'
import WorkspaceDropdown from './../containers/WorkspaceDropdown'
import RequestGroupActionsDropdown from './../containers/RequestGroupActionsDropdown'
import DebouncingInput from './base/DebouncingInput'
import SidebarRequestRow from './SidebarRequestRow'

class Sidebar extends Component {
  onFilterChange (value) {
    this.props.changeFilter(value);
  }

  renderRequestGroupRow (requestGroup = null) {
    const {
      filter,
      activeRequestId,
      addRequestToRequestGroup,
      toggleRequestGroup,
      requests,
      workspaceId
    } = this.props;

    let filteredRequests = requests.filter(
      r => {
        // TODO: Move this to a lib file

        if (!filter) {
          return true;
        }

        const requestGroupName = requestGroup ? requestGroup.name : '';
        const toMatch = `${requestGroupName}✌${r.method}✌${r.name}`.toLowerCase();
        const matchTokens = filter.toLowerCase().split(' ');
        for (let i = 0; i < matchTokens.length; i++) {
          let token = `${matchTokens[i]}`;
          if (toMatch.indexOf(token) === -1) {
            return false;
          }
        }

        return true;
      }
    );

    if (!requestGroup) {
      filteredRequests = filteredRequests.filter(r => r.parentId === workspaceId);
      return filteredRequests.map(request => this.renderRequestRow(request));
    }

    // Grab all of the children for this request group
    filteredRequests = filteredRequests.filter(r => r.parentId === requestGroup._id);

    // Don't show folder if it was not in the filter
    if (filter && !filteredRequests.length) {
      return null;
    }

    const isActive = activeRequestId && filteredRequests.find(r => r._id == activeRequestId);

    let folderIconClass = 'fa-folder';
    let expanded = !requestGroup.collapsed;
    folderIconClass += !expanded ? '' : '-open';
    folderIconClass += isActive ? '' : '-o';

    const sidebarItemClassNames = classnames(
      'sidebar__item',
      'sidebar__item--bordered',
      {'sidebar__item--active': isActive}
    );

    return (
      <li key={requestGroup._id}>
        <div className={sidebarItemClassNames}>
          <div className="sidebar__item__row sidebar__item__row--heading">
            <button onClick={e => toggleRequestGroup(requestGroup)}>
              <i className={'fa ' + folderIconClass}></i>
              &nbsp;&nbsp;&nbsp;{requestGroup.name}
            </button>
          </div>
          <div className="sidebar__item__btn grid">
            <button onClick={(e) => addRequestToRequestGroup(requestGroup)}>
              <i className="fa fa-plus-circle"></i>
            </button>
            <RequestGroupActionsDropdown
              requestGroup={requestGroup}
              right={true}
              className="tall"/>
          </div>
        </div>
        <ul>
          {expanded && !filteredRequests.length ? this.renderRequestRow() : null}
          {!expanded ? null : filteredRequests.map(request => this.renderRequestRow(request, requestGroup))}
        </ul>
      </li>
    );
  }

  renderRequestRow (request = null, requestGroup = null) {
    const {activeRequestId, activateRequest} = this.props;
    const isActive = request && activeRequestId && request._id === activeRequestId;
    
    return (
      <SidebarRequestRow
        key={request._id}
        activateRequest={activateRequest}
        isActive={isActive}
        request={request}
        requestGroup={requestGroup}
      />
    )
  }

  render () {
    const {filter, requestGroups} = this.props;
    
    return (
      <section className="sidebar bg-dark grid--v section section--bordered">
        <header className="header bg-brand section__header">
          <WorkspaceDropdown />
        </header>
        <div className="grid--v grid--start grid__cell section__body">
          <ul
            className="grid--v grid--start grid__cell sidebar__scroll hover-scrollbars sidebar__request-list">
            {this.renderRequestGroupRow(null)}
            {requestGroups.map(requestGroup => this.renderRequestGroupRow(requestGroup))}
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
  requests: PropTypes.array.isRequired,
  requestGroups: PropTypes.array.isRequired,
  workspaceId: PropTypes.string.isRequired,
  
  // Optional
  filter: PropTypes.string,
  activeRequestId: PropTypes.string
};

export default Sidebar;
