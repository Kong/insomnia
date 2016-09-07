import React, {Component, PropTypes} from 'react';
import Dropdown from '../base/Dropdown';
import DropdownHint from '../base/DropdownHint';
import {DEBOUNCE_MILLIS} from '../../lib/constants';
import {isMac} from '../../lib/appInfo';


class SidebarFilter extends Component {
  _onChange (value) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);
  }

  componentDidMount () {
    this._keydownCallback = e => {
      const isMeta = isMac() ? e.metaKey : e.ctrlKey;

      if (isMeta && e.keyCode === 78 && this._firstDropdownItem) { // 'N' key
        this._dropdown.toggle();
        this._firstDropdownItem.focus();
      }
    };

    document.body.addEventListener('keydown', this._keydownCallback);
  }

  componentWillUnmount () {
    // In order for this to work, there needs to be tabIndex of -1 on the modal container
    document.body.removeEventListener('keydown', this._keydownCallback);
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
        <Dropdown right={true} ref={n => this._dropdown = n}>
          <button className="btn btn--compact">
            <i className="fa fa-plus-circle"></i>
          </button>
          <ul>
            <li>
              <button onClick={e => requestCreate()}
                      ref={n => this._firstDropdownItem = n}>
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
