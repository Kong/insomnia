import React, {PropTypes} from 'react'
import classnames from 'classnames'

import RequestActionsDropdown from './../containers/RequestActionsDropdown'
import MethodTag from './MethodTag'

const SidebarRequestRow = ({request, requestGroup, isActive, activateRequest}) => {
  if (!request) {
    return (
      <li className="sidebar__item">
        <em>No Requests</em>
      </li>
    )
  }

  return (
    <li className="sidebar__row">

      <div className={classnames('sidebar__item', {active: isActive})}>

        <button className="sidebar__clickable" onClick={() => {activateRequest(request)}}>
          <MethodTag method={request.method}/> {request.name}
        </button>

        <div className="sidebar__actions">
          <RequestActionsDropdown
            right={true}
            request={request}
            requestGroup={requestGroup}
          />
        </div>

      </div>
    </li>
  )
};

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
