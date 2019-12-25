// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { DEBOUNCE_MILLIS } from '../../../common/constants';
import KeydownBinder from '../keydown-binder';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import SidebarCreateDropdown from './sidebar-create-dropdown';

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
          <SidebarCreateDropdown
            handleCreateRequest={this._handleRequestCreate}
            handleCreateRequestGroup={this._handleRequestGroupCreate}
            hotKeyRegistry={hotKeyRegistry}
          />
        </div>
      </KeydownBinder>
    );
  }
}

export default SidebarFilter;
