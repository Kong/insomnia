import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { RequestGroup } from '../../../models/request-group';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';

interface Props {
  handleCreateRequest: (id: string) => any;
  handleCreateRequestGroup: (requestGroup: RequestGroup) => any;
  hotKeyRegistry: HotKeyRegistry;
  right?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SidebarCreateDropdown extends PureComponent<Props> {
  _dropdown: Dropdown | null = null;

  show(position: { x: number; y: number }) {
    if (this._dropdown) {
      this._dropdown.show(false, position);
    }
  }

  _setDropdownRef(n: Dropdown) {
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
