import React, {Component, PropTypes} from 'react';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import {DEBOUNCE_MILLIS} from '../../../common/constants';


class SidebarFilter extends Component {
  _onChange (value) {
    clearTimeout(this._askTimeout);
    this._askTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);
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
          <DropdownItem onClick={e => requestCreate()}>
            <i className="fa fa-plus-circle"></i> New Request
            <DropdownHint char="N"></DropdownHint>
          </DropdownItem>
          <DropdownItem onClick={e => requestGroupCreate()}>
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
