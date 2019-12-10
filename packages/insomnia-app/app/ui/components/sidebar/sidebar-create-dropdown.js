// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import { Dropdown, DropdownHint, DropdownButton, DropdownItem } from '../base/dropdown';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';

type Props = {
  handleCreateRequest: Function,
  handleCreateRequestGroup: Function,
  hotKeyRegistry: HotKeyRegistry,
  right?: boolean,
};

@autobind
class SidebarCreateDropdown extends React.PureComponent<Props> {
  _dropdown: ?Dropdown;

  show(position: { x: number, y: number }) {
    if (this._dropdown) {
      this._dropdown.show(false, position);
    }
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  render() {
    const { handleCreateRequest, handleCreateRequestGroup, hotKeyRegistry, right } = this.props;

    return (
      <Dropdown ref={this._setDropdownRef} right={right}>
        <DropdownButton className="btn btn--compact">
          <i className="fa fa-plus-circle" />
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem onClick={handleCreateRequest}>
          <i className="fa fa-plus-circle" /> New Request
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE.id]} />
        </DropdownItem>
        <DropdownItem onClick={handleCreateRequestGroup}>
          <i className="fa fa-folder" /> New Folder
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER.id]} />
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default SidebarCreateDropdown;
