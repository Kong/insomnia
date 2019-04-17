// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import EnvironmentsModal from '../modals/workspace-environments-edit-modal';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownHint,
  DropdownItem,
} from '../base/dropdown';
import { showModal } from '../modals/index';
import Tooltip from '../tooltip';
import KeydownBinder from '../keydown-binder';
import type { Workspace } from '../../../models/workspace';
import type { Environment } from '../../../models/environment';
import type { HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';

type Props = {
  handleChangeEnvironment: Function,
  workspace: Workspace,
  environments: Array<Environment>,
  environmentHighlightColorStyle: String,
  hotKeyRegistry: HotKeyRegistry,

  // Optional
  className?: string,
  activeEnvironment: Environment | null,
};

@autobind
class EnvironmentsDropdown extends React.PureComponent<Props> {
  _dropdown: ?Dropdown;

  _handleActivateEnvironment(environmentId: string) {
    this.props.handleChangeEnvironment(environmentId);
  }

  _handleShowEnvironmentModal() {
    showModal(EnvironmentsModal, this.props.workspace);
  }

  _setDropdownRef(n: ?Dropdown) {
    this._dropdown = n;
  }

  renderEnvironmentItem(environment: Environment) {
    return (
      <DropdownItem
        key={environment._id}
        value={environment._id}
        onClick={this._handleActivateEnvironment}>
        <i className="fa fa-random" style={{ color: environment.color }} />
        Use <strong>{environment.name}</strong>
      </DropdownItem>
    );
  }

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU, () => {
      this._dropdown && this._dropdown.toggle(true);
    });
  }

  render() {
    const {
      className,
      workspace,
      environments,
      activeEnvironment,
      environmentHighlightColorStyle,
      hotKeyRegistry,
      ...other
    } = this.props;

    // NOTE: Base environment might not exist if the users hasn't managed environments yet.
    const baseEnvironment = environments.find(e => e.parentId === workspace._id);
    const subEnvironments = environments
      .filter(e => e.parentId === (baseEnvironment && baseEnvironment._id))
      .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);

    let description;
    if (!activeEnvironment || activeEnvironment === baseEnvironment) {
      description = 'No Environment';
    } else {
      description = activeEnvironment.name;
    }

    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <Dropdown ref={this._setDropdownRef} {...other} className={className}>
          <DropdownButton className="btn btn--super-compact no-wrap">
            <div className="sidebar__menu__thing">
              {!activeEnvironment &&
                subEnvironments.length > 0 && (
                  <Tooltip
                    message="No environments active. Please select one to use."
                    className="space-right"
                    position="right">
                    <i className="fa fa-exclamation-triangle notice" />
                  </Tooltip>
                )}
              <div className="sidebar__menu__thing__text">
                {activeEnvironment &&
                activeEnvironment.color &&
                environmentHighlightColorStyle === 'sidebar-indicator' ? (
                  <i
                    className="fa fa-circle space-right"
                    style={{ color: activeEnvironment.color }}
                  />
                ) : null}
                {description}
              </div>
              <i className="space-left fa fa-caret-down" />
            </div>
          </DropdownButton>

          <DropdownDivider>Activate Environment</DropdownDivider>
          {subEnvironments.map(this.renderEnvironmentItem)}

          <DropdownItem value={null} onClick={this._handleActivateEnvironment}>
            <i className="fa fa-empty" /> No Environment
          </DropdownItem>

          <DropdownDivider>General</DropdownDivider>

          <DropdownItem onClick={this._handleShowEnvironmentModal}>
            <i className="fa fa-wrench" /> Manage Environments
            <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]} />
          </DropdownItem>
        </Dropdown>
      </KeydownBinder>
    );
  }
}

export default EnvironmentsDropdown;
