import React, {PureComponent, PropTypes} from 'react';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';


class SidebarFilter extends PureComponent {
  _handleOnChange = (e) => {
    const value = e.target.value;

    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);

    // So we don't track on every keystroke, give analytics a longer timeout
    clearTimeout(this._analyticsTimeout);
    this._analyticsTimeout = setTimeout(() => {
      trackEvent('Sidebar', 'Filter', value ? 'Change' : 'Clear');
    }, 2000);
  };

  _handleRequestGroupCreate = () => {
    this.props.requestGroupCreate();
    trackEvent('Folder', 'Create', 'Sidebar Filter');
  };

  _handleRequestCreate = () => {
    this.props.requestCreate();
    trackEvent('Request', 'Create', 'Sidebar Filter');
  };

  render () {
    return (
      <div className="sidebar__filter">
        <div className="form-control form-control--outlined">
          <input
            type="text"
            placeholder="Filter"
            defaultValue={this.props.filter}
            onChange={this._handleOnChange}
          />
        </div>
        <Dropdown right={true}>
          <DropdownButton className="btn btn--compact">
            <i className="fa fa-plus-circle"></i>
          </DropdownButton>
          <DropdownItem onClick={this._handleRequestCreate}>
            <i className="fa fa-plus-circle"></i> New Request
            <DropdownHint char="N"></DropdownHint>
          </DropdownItem>
          <DropdownItem onClick={this._handleRequestGroupCreate}>
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
  filter: PropTypes.string.isRequired
};

export default SidebarFilter;
