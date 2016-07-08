import React, {PropTypes, Component} from 'react'
import classnames from 'classnames'

import RequestActionsDropdown from '../containers/RequestActionsDropdown'
import Editable from './base/Editable'
import MethodTag from './MethodTag'
import * as db from '../database'


const SidebarRequestRow = ({request, requestGroup, isActive, activateRequest}) => {
  if (!request) {
    return (
      <li className="sidebar__item">
        <button className="sidebar__clickable" onClick={() => db.requestCreate({parentId: requestGroup._id})}>
          <em>click to add first request...</em>
        </button>
      </li>
    )
  }

  return (
    <li className="sidebar__row">
      <div className={classnames('sidebar__item', {active: isActive})}>
        <button onClick={() => {activateRequest(request)}}>
          <div className="sidebar__clickable">
            <MethodTag method={request.method}/>
            <Editable
              value={request.name}
              onSubmit={name => db.requestUpdate(request, {name})}
            />
          </div>
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
