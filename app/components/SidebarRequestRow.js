import React, {Component, PropTypes} from 'react'
import RequestActionsDropdown from './../containers/RequestActionsDropdown'
import MethodTag from './MethodTag'

class SidebarRequestRow extends Component {
  render () {
    const {request, requestGroup, isActive, activateRequest} = this.props;

    return (
      <li key={request ? request._id : 'none'}>
        <div className={'sidebar__item ' + (isActive ? 'sidebar__item--active' : '')}>
          <div className="sidebar__item__row">
            {request ? (
              <button onClick={() => {activateRequest(request)}}>
                <MethodTag method={request.method}/> {request.name}
              </button>
            ) : (
              <button className="italic">No Requests</button>
            )}
          </div>
          {request ? (
            <RequestActionsDropdown
              className="sidebar__item__btn"
              right={true}
              request={request}
              requestGroup={requestGroup}
            />
          ) : null}
        </div>
      </li>
    );
  }
}

SidebarRequestRow.propTypes = {
  // Functions
  activateRequest: PropTypes.func.isRequired,
  
  // Other
  isActive: PropTypes.bool.isRequired,
  
  // Optional
  requestGroup: PropTypes.object,
  request: PropTypes.object
};

export default SidebarRequestRow;
