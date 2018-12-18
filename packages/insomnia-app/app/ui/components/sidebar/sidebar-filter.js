// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownHint, DropdownButton, DropdownItem } from '../base/dropdown';
import { DEBOUNCE_MILLIS } from '../../../common/constants';
import KeydownBinder from '../keydown-binder';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';

type Props = {
  onChange: string => void,
  requestCreate: () => void,
  requestGroupCreate: () => void,
  filter: string,
  hotKeyRegistry: HotKeyRegistry,
};

@autobind
class SidebarFilter extends React.PureComponent<Props> {
  _input: ?HTMLInputElement;
  _triggerTimeout: TimeoutID;

  _setInputRef(n: ?HTMLInputElement) {
    this._input = n;
  }

  _handleClearFilter(e: SyntheticEvent<HTMLButtonElement>) {
    this.props.onChange('');
    if (this._input) {
      this._input.value = '';
      this._input.focus();
    }
  }

  _handleOnChange(e: SyntheticEvent<HTMLInputElement>) {
    const value = e.currentTarget.value;

    clearTimeout(this._triggerTimeout);
    this._triggerTimeout = setTimeout(() => {
      this.props.onChange(value);
    }, DEBOUNCE_MILLIS);
  }

  _handleRequestGroupCreate() {
    this.props.requestGroupCreate();
  }

  _handleRequestCreate() {
    this.props.requestCreate();
  }

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.SIDEBAR_FOCUS_FILTER, () => {
      this._input && this._input.focus();
    });
  }

  render() {
    const { filter, hotKeyRegistry } = this.props;
    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <div className="sidebar__filter">
          <div className="form-control form-control--outlined form-control--btn-right">
            <input
              ref={this._setInputRef}
              type="text"
              placeholder="Filter"
              defaultValue={filter}
              onChange={this._handleOnChange}
            />
            {filter && (
              <button className="form-control__right" onClick={this._handleClearFilter}>
                <i className="fa fa-times-circle" />
              </button>
            )}
          </div>
          <Dropdown right>
            <DropdownButton className="btn btn--compact">
              <i className="fa fa-plus-circle" />
              <i className="fa fa-caret-down" />
            </DropdownButton>
            <DropdownItem onClick={this._handleRequestCreate}>
              <i className="fa fa-plus-circle" /> New Request
              <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE.id]} />
            </DropdownItem>
            <DropdownItem onClick={this._handleRequestGroupCreate}>
              <i className="fa fa-folder" /> New Folder
              <DropdownHint
                keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]}
              />
            </DropdownItem>
          </Dropdown>
        </div>
      </KeydownBinder>
    );
  }
}

export default SidebarFilter;
