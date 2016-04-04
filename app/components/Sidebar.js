import React, {Component, PropTypes} from 'react'
import WorkspaceDropdown from './dropdowns/WorkspaceDropdown'
import DebouncingInput from './base/DebouncingInput'
import RequestActionsDropdown from './dropdowns/RequestActionsDropdown'
import MethodTag from './MethodTag'
import Dropdown from './base/Dropdown'

class Sidebar extends Component {
  onFilterChange (value) {
    this.props.changeFilter(value);
  }

  renderRequestGroupRow (requestGroup) {
    const {activeFilter, activeRequest, addRequest, toggleRequestGroup, requests, requestGroups} = this.props;

    let filteredRequests = requests.filter(
      r => r.name.toLowerCase().indexOf(activeFilter.toLowerCase()) != -1
    );

    if (!requestGroup) {
      // Grab all requests that are not children of request groups
      filteredRequests = filteredRequests.filter(r => {
        return !requestGroups.find(rg => {
          return rg.children.find(c => c.id === r.id)
        })
      });

      return filteredRequests.map(request => this.renderRequestRow(request));
    } else {
      // Grab all of the children for this request group
      filteredRequests = filteredRequests.filter(
        r => requestGroup.children.find(c => c.id === r.id)
      );

      const isActive = activeRequest && filteredRequests.find(r => r.id == activeRequest.id);

      let folderIconClass = 'fa-folder';
      folderIconClass += requestGroup.collapsed ? '' : '-open';
      folderIconClass += isActive ? '' : '-o';

      return (
        <li key={requestGroup.id}>
          <div
            className={'sidebar__item sidebar__item--bordered ' + (isActive ? 'sidebar__item--active' : '')}>
            <div className="sidebar__item__row">
              <button onClick={e => toggleRequestGroup(requestGroup.id)}>
                <i className={'fa ' + folderIconClass}></i>
                &nbsp;&nbsp;&nbsp;{requestGroup.name}
              </button>
            </div>
            <div className="sidebar__item__btn">
              <button onClick={(e) => addRequest(requestGroup.id)}>
                <i className="fa fa-plus-circle"></i>
              </button>
              <Dropdown right={true} className="tall">
                <button>
                  <i className="fa fa-caret-down"></i>
                </button>
                <ul>
                  <li><button>Hello</button></li>
                  <li><button>Hello</button></li>
                  <li><button>Hello</button></li>
                </ul>
              </Dropdown>
            </div>
          </div>
          <ul>
            {requestGroup.collapsed ? null : filteredRequests.map(request => this.renderRequestRow(request))}
          </ul>
        </li>
      )
    }
  }

  renderRequestRow (request) {
    const {activeRequest, activateRequest} = this.props;
    const isActive = activeRequest && request.id === activeRequest.id;

    return (
      <li key={request.id}>
        <div className={'sidebar__item ' + (isActive ? 'sidebar__item--active' : '')}>
          <div className="sidebar__item__row">
            <button onClick={() => {activateRequest(request.id)}}>
              <MethodTag method={request.method}/> {request.name}
            </button>
          </div>
          <RequestActionsDropdown
            className="sidebar__item__btn"
            right={true}
            request={request}
          />
        </div>
      </li>
    );
  }

  render () {
    const {activeFilter, requestGroups} = this.props;

    return (
      <aside className="sidebar pane">
        <div className="grid-v">
          <header className="pane__header bg-dark">
            <h1><WorkspaceDropdown /></h1>
          </header>
          <div className="pane__body hide-scrollbars bg-dark">
            <div className="stock-height form-control form-control--outlined col">
              <DebouncingInput
                type="text"
                placeholder="Filter Requests"
                debounceMillis={100}
                value={activeFilter}
                onChange={this.onFilterChange.bind(this)}/>
            </div>
            <ul>
              {this.renderRequestGroupRow(null)}
              {requestGroups.map(requestGroup => this.renderRequestGroupRow(requestGroup))}
            </ul>
          </div>
        </div>
      </aside>
    )
  }
}

Sidebar.propTypes = {
  activateRequest: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
  toggleRequestGroup: PropTypes.func.isRequired,
  activeFilter: PropTypes.string,
  requests: PropTypes.array.isRequired,
  requestGroups: PropTypes.array.isRequired,
  activeRequest: PropTypes.object
};

export default Sidebar;
