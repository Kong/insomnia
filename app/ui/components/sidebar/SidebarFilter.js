import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';


class SidebarFilter extends Component {
  _onChange (value) {
    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);

    // So we don't track on every keystroke, give analytics a longer timeout
    clearTimeout(this._analyticsTimeout);
    this._analyticsTimeout = setTimeout(() => {
      trackEvent('Sidebar', 'Filter', value ? 'Change' : 'Clear');
    }, 2000);
  }

  render () {
    const {filter, requestCreate, requestGroupCreate} = this.props;

    return (
      <div className="sidebar__filter">
        <div className="form-control form-control--outlined">
          <input
            type="text"
            placeholder="Filter"
            defaultValue={filter}
            onChange={e => this._onChange(e.target.value)}
          />
        </div>
        <Dropdown right={true}>
          <DropdownButton className="btn btn--compact">
            <i className="fa fa-plus-circle"></i>
          </DropdownButton>
          <DropdownItem onClick={e => {
            requestCreate();
            trackEvent('Request', 'Create', 'Sidebar Filter');
          }}>
            <i className="fa fa-plus-circle"></i> New Request
            <DropdownHint char="N"></DropdownHint>
          </DropdownItem>
          <DropdownItem onClick={e => {
            requestGroupCreate();
            trackEvent('Folder', 'Create', 'Sidebar Filter');
          }}>
            <i className="fa fa-folder"></i> New Folder
          </DropdownItem>
        </Dropdown>
      </div>

    )
  }
}

SidebarFilter.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  requestCreate: PropTypes.func.isRequired,
  requestGroupCreate: PropTypes.func.isRequired,

  // Optional
  filter: PropTypes.string
};

export default SidebarFilter;
