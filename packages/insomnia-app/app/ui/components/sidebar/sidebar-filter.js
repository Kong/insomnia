import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownHint, DropdownButton, DropdownItem} from '../base/dropdown';
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import KeydownBinder from '../keydown-binder';
import * as hotkeys from '../../../common/hotkeys';

@autobind
class SidebarFilter extends PureComponent {
  _setInputRef (n) {
    this._input = n;
  }

  _handleOnChange (e) {
    const value = e.target.value;

    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);

    // So we don't track on every keystroke, give analytics a longer timeout
    clearTimeout(this._analyticsTimeout);
  }

  _handleRequestGroupCreate () {
    this.props.requestGroupCreate();
  }

  _handleRequestCreate () {
    this.props.requestCreate();
  }

  _handleKeydown (e) {
    hotkeys.executeHotKey(e, hotkeys.FOCUS_FILTER, () => {
      this._input && this._input.focus();
    });
  }

  render () {
    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <div className="sidebar__filter">
          <div className="form-control form-control--outlined">
            <input
              ref={this._setInputRef}
              type="text"
              placeholder="Filter"
              defaultValue={this.props.filter}
              onChange={this._handleOnChange}
            />
          </div>
          <Dropdown right>
            <DropdownButton className="btn btn--compact">
              <i className="fa fa-plus-circle"/><i className="fa fa-caret-down"/>
            </DropdownButton>
            <DropdownItem onClick={this._handleRequestCreate}>
              <i className="fa fa-plus-circle"/> New Request
              <DropdownHint hotkey={hotkeys.CREATE_REQUEST}/>
            </DropdownItem>
            <DropdownItem onClick={this._handleRequestGroupCreate}>
              <i className="fa fa-folder"/> New Folder
              <DropdownHint hotkey={hotkeys.CREATE_FOLDER}/>
            </DropdownItem>
          </Dropdown>
        </div>
      </KeydownBinder>
    );
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
