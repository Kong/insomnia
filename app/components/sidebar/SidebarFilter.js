import React, {Component, PropTypes} from 'react';
import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import {DEBOUNCE_MILLIS} from '../../lib/constants';


class SidebarFilter extends Component {
  _onChange (value) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
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
          <button className="btn btn--compact">
            <i className="fa fa-plus-circle"></i>
          </button>
          <ul>
            <li>
              <button onClick={e => requestCreate()}>
                <i className="fa fa-plus-circle"></i> New Request
                <DropdownHint char="N"></DropdownHint>
              </button>
            </li>
            <li>
              <button onClick={e => requestGroupCreate()}>
                <i className="fa fa-folder"></i> New Folder
              </button>
            </li>
          </ul>
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
