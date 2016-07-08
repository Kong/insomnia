import React, {PropTypes} from 'react'
import classnames from 'classnames'

import RequestGroupActionsDropdown from './../containers/RequestGroupActionsDropdown'
import SidebarRequestRow from './SidebarRequestRow'
import * as db from '../database'

const SidebarRequestGroupRow = ({
  children,
  requestGroup,
  isActive,
  toggleRequestGroup,
  addRequestToRequestGroup,
}) => {
  let folderIconClass = 'fa-folder';
  let expanded = !requestGroup.collapsed;
  folderIconClass += !expanded ? '' : '-open';
  folderIconClass += isActive ? '' : '-o';

  return (
    <li key={requestGroup._id}
        className={classnames('sidebar__row', {active: isActive})}>

      <div className={classnames('sidebar__item sidebar__item--big', {active: isActive})}>
        <button onClick={e => toggleRequestGroup(requestGroup)}>
          <div className="sidebar__clickable">
            <i className={'sidebar__item__icon fa ' + folderIconClass}></i>
            <span>{requestGroup.name}</span>
          </div>
        </button>

        <div className="sidebar__actions">
          <button onClick={(e) => addRequestToRequestGroup(requestGroup)}>
            <i className="fa fa-plus-circle"></i>
          </button>
          <RequestGroupActionsDropdown
            requestGroup={requestGroup}
            right={true}
          />
        </div>
      </div>

      <ul className="sidebar__list">
        {!expanded || children.length > 0 ? null : (
          <SidebarRequestRow
            activateRequest={() => {}}
            isActive={false}
            request={null}
            requestGroup={requestGroup}
          />
        )}
        {expanded ? children : null}
      </ul>
    </li>
  );
};

SidebarRequestGroupRow.propTypes = {
  // Functions
  toggleRequestGroup: PropTypes.func.isRequired,
  addRequestToRequestGroup: PropTypes.func.isRequired,

  // Other
  isActive: PropTypes.bool.isRequired,
  requestGroup: PropTypes.object.isRequired
};

export default SidebarRequestGroupRow;
