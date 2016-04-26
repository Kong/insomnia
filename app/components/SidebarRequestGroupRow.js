import React, {Component, PropTypes} from 'react'
import classnames from 'classnames'
import RequestGroupActionsDropdown from './../containers/RequestGroupActionsDropdown'
import SidebarRequestRow from './SidebarRequestRow'

class SidebarRequestGroupRow extends Component {
  render () {
    const {
      children,
      hideIfNoChildren,
      requestGroup,
      isActive,
      toggleRequestGroup,
      addRequestToRequestGroup
    } = this.props;
    
    // If we are supposed to have children, but aren't passed any, we are probably
    // filtering so don't render anything
    if (hideIfNoChildren && children.length === 0) {
      return null;
    }

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
          {!expanded || children.length > 0 ? null : (
            <SidebarRequestRow
              activateRequest={() => {}}
              isActive={false}
              request={null}
            />
          )}
          {expanded ? children : null}
        </ul>
      </li>
    );
  }
}

SidebarRequestGroupRow.propTypes = {
  // Functions
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,
  
  // Other
  isActive: PropTypes.bool.isRequired,
  hideIfNoChildren: PropTypes.bool.isRequired,
  requestGroup: PropTypes.object.isRequired
};

export default SidebarRequestGroupRow;
