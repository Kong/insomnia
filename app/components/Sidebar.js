import React, {Component, PropTypes} from 'react'
import Dropdown from './base/Dropdown'
import DebouncingInput from './base/DebouncingInput'
import RequestActionsDropdown from './dropdowns/RequestActionsDropdown'

class Sidebar extends Component {
  onFilterChange (value) {
    this.props.changeFilter(value);
  }

  renderRequestGroupRow (requestGroup) {
    const {activeFilter, addRequest, requests} = this.props;

    const filteredRequests = requests.filter(
      r => !requestGroup || requestGroup.requests.find(r.id)
    ).filter(
      r => r.name.toLowerCase().indexOf(activeFilter.toLowerCase()) >= 0
    );

    if (requestGroup) {
      return (
        <li>
          <div className="grid">
            <button className="sidebar__item col text-left">
              <i className="fa fa-folder-open-o"></i>&nbsp;&nbsp;&nbsp;Request Group
            </button>
            <button className="sidebar__item-btn" onClick={(e) => addRequest()}>
              <i className="fa fa-plus-circle"></i>
            </button>
          </div>
          <ul>
            {filteredRequests.map(request => this.renderRequestRow(request))}
          </ul>
        </li>
      )
    } else {
      return (
        filteredRequests.map(request => this.renderRequestRow(request))
      )
    }
  }

  renderRequestRow (request) {
    const {activeRequest, activateRequest} = this.props;
    const isActive = activeRequest && request.id === activeRequest.id;
    const className = ['grid'].concat(isActive ? ['active'] : '');

    return (
      <li key={request.id} className={className.join(' ')}>
        <button className='sidebar__item col' onClick={() => {activateRequest(request.id)}}>
          {request.name}
        </button>
        <RequestActionsDropdown right={true} request={request}/>
      </li>
    );
  }

  render () {
    const {activeFilter, loading, addRequest, requestGroups} = this.props;

    return (
      <aside className="sidebar pane">
        <div className="grid-v">
          <header className="pane__header bg-primary">
            <h1>
              <Dropdown right={true}>
                <button className="pane__header__content">
                  <i className="fa fa-angle-down pull-right"></i>
                  {loading ? <i className="fa fa-refresh fa-spin pull-right"></i> : ''}
                  Insomnia
                </button>
                <ul className="bg-super-light">
                  <li>
                    <button onClick={(e) => addRequest()}>
                      <i className="fa fa-plus-circle"></i> Add Request
                    </button>
                  </li>
                  <li><button><i className="fa fa-share-square-o"></i> Import/Export</button></li>
                  <li><button><i className="fa fa-empty"></i> Toggle Sidebar</button></li>
                  <li><button><i className="fa fa-empty"></i> Delete Workspace</button></li>
                </ul>
              </Dropdown>
            </h1>
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
  addRequest: PropTypes.func.isRequired,
  changeFilter: PropTypes.func.isRequired,
  activeFilter: PropTypes.string,
  requests: PropTypes.array.isRequired,
  requestGroups: PropTypes.array.isRequired,
  activeRequest: PropTypes.object,
  loading: PropTypes.bool.isRequired
};

export default Sidebar;
