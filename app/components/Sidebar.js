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

  renderRequestGroupRow (child, parent) {
    const {
      filter,
      activeRequestId,
      addRequestToRequestGroup,
      toggleRequestGroup
    } = this.props;
    
    const requestGroup = child.doc.type === 'RequestGroup' ? child.doc : null;

    if (!requestGroup) {
      return child.children.map(c => this._renderChild(c, child));
    }

    // Don't show folder if it was not in the filter
    if (filter && !child.children.length) {
      return null;
    }

    const isActive = activeRequestId && child.children.find(c => c.doc._id == activeRequestId);

    let folderIconClass = 'fa-folder';
    let expanded = !requestGroup.collapsed;
    folderIconClass += !expanded ? '' : '-open';
    folderIconClass += isActive ? '' : '-o';

    const sidebarItemClassNames = classnames(
      'sidebar__item',
      'sidebar__item--bordered',
      {'sidebar__item--active': isActive}
    );

    child.children.sort((a, b) => a.doc._id > b.doc._id ? -1 : 1);

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
          {expanded && !child.children.length ? this.renderRequestRow() : null}
          {!expanded ? null : child.children.map(c => this._renderChild(c, child))}
        </ul>
      </li>
    );
  }

  renderRequestRow (child = null, parent = null) {
    const request = child ? child.doc : null;
    const requestGroup = parent ? parent.doc : null;
    const {activeRequestId, activateRequest} = this.props;
    const isActive = request && activeRequestId && request._id === activeRequestId || false;

    return (
      <SidebarRequestRow
        key={request ? request._id : null}
        activateRequest={activateRequest}
        isActive={isActive}
        request={request}
        requestGroup={requestGroup}
      />
    )
  }

  _renderChild (child, parent = null) {
    const {filter} = this.props;

    if (child.doc.type === 'Request') {
      const r = child.doc;
      const toMatch = `${r.method}❅${r.name}`.toLowerCase();
      const matchTokens = filter.toLowerCase().split(' ');
      for (let i = 0; i < matchTokens.length; i++) {
        let token = `${matchTokens[i]}`;
        if (toMatch.indexOf(token) === -1) {
          // Filter failed. Don't render children
          return null;
        }
      }

      return this.renderRequestRow(child, parent)
    } else if (child.doc.type === 'RequestGroup') {
      return this.renderRequestGroupRow(child, parent);
    } else {
      console.error('Unknown child type', child.doc.type);
    }
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
            {children.map(c => this._renderChild(c))}
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
