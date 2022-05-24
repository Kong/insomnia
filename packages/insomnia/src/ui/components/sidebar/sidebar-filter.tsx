import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { HotKeyRegistry } from 'insomnia-common';
import React, { FunctionComponent, PureComponent, useRef } from 'react';

import { AUTOBIND_CFG, DEBOUNCE_MILLIS, SortOrder } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { useHotKeyEffect } from '../hotkeys';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarSortDropdown } from './sidebar-sort-dropdown';

interface Props {
  onChange: (value: string) => Promise<void>;
  requestCreate: () => void;
  requestGroupCreate: () => void;
  sidebarSort: (sortOrder: SortOrder) => void;
  filter: string;
  hotKeyRegistry: HotKeyRegistry;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class SidebarFilterPure extends PureComponent<Props> {
  _input: HTMLInputElement | null = null;
  _triggerTimeout: NodeJS.Timeout | null = null;

  _setInputRef(n: HTMLInputElement) {
    this._input = n;
  }

  _handleClearFilter() {
    this.props.onChange('');

    if (this._input) {
      this._input.value = '';

      this._input.focus();
    }
  }

  _handleOnChange(e: React.SyntheticEvent<HTMLInputElement>) {
    const value = e.currentTarget.value;
    if (this._triggerTimeout) {
      clearTimeout(this._triggerTimeout);
    }
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

  render() {
    const { filter, hotKeyRegistry, sidebarSort } = this.props;
    return (
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
        <SidebarSortDropdown handleSort={sidebarSort} />
        <SidebarCreateDropdown
          handleCreateRequest={this._handleRequestCreate}
          handleCreateRequestGroup={this._handleRequestGroupCreate}
          hotKeyRegistry={hotKeyRegistry}
        />
      </div>
    );
  }
}

export const SidebarFilter: FunctionComponent<Props> = props => {
  /**
   * TODO: refactor the original component into functional component to avoid imperative control of the component.
   * */
  const ref = useRef<SidebarFilterPure>(null);

  useHotKeyEffect(() => {
    ref.current?._input?.focus();
  }, hotKeyRefs.SIDEBAR_FOCUS_FILTER.id);

  return <SidebarFilterPure ref={ref} {...props} />;
};
