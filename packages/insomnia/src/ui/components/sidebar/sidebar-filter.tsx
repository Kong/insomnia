import { HotKeyRegistry } from 'insomnia-common';
import React, { FC, useCallback, useRef } from 'react';

import { SortOrder } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import { KeydownBinder } from '../keydown-binder';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarSortDropdown } from './sidebar-sort-dropdown';

interface Props {
  onChange: (value: string) => Promise<void>;
  sidebarSort: (sortOrder: SortOrder) => void;
  filter: string;
  hotKeyRegistry: HotKeyRegistry;
}
export const SidebarFilter: FC<Props> = ({ filter, hotKeyRegistry, sidebarSort, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleClearFilter = useCallback(() => {
    onChange('');
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
  }, [onChange]);
  const handleOnChange = useCallback((event: React.SyntheticEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value);
  }, [onChange]);
  const handleKeydown = useCallback((event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.SIDEBAR_FOCUS_FILTER, () => {
      inputRef.current?.focus();
    });
  }, []);
  return (
    <KeydownBinder onKeydown={handleKeydown}>
      <div className="sidebar__filter">
        <div className="form-control form-control--outlined form-control--btn-right">
          <input
            ref={inputRef}
            type="text"
            placeholder="Filter"
            defaultValue={filter}
            onChange={handleOnChange}
          />
          {filter && (
            <button className="form-control__right" onClick={handleClearFilter}>
              <i className="fa fa-times-circle" />
            </button>
          )}
        </div>
        <SidebarSortDropdown handleSort={sidebarSort} />
        <SidebarCreateDropdown
          hotKeyRegistry={hotKeyRegistry}
        />
      </div>
    </KeydownBinder>
  );
};
