import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { EnvironmentHighlightColorStyle, HotKeyRegistry } from 'insomnia-common';
import React, { FunctionComponent, PureComponent, useRef } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import type { Environment } from '../../../models/environment';
import type { Workspace } from '../../../models/workspace';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { useHotKeyEffect } from '../hotkeys';
import { showModal } from '../modals/index';
import { WorkspaceEnvironmentsEditModal } from '../modals/workspace-environments-edit-modal';
import { Tooltip } from '../tooltip';

interface Props {
  handleChangeEnvironment: Function;
  workspace: Workspace;
  environments: Environment[];
  environmentHighlightColorStyle: EnvironmentHighlightColorStyle;
  hotKeyRegistry: HotKeyRegistry;
  className?: string;
  activeEnvironment?: Environment | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class EnvironmentsDropdownOriginal extends PureComponent<Props> {
  _dropdown: Dropdown | null = null;

  _handleActivateEnvironment(environmentId: string) {
    this.props.handleChangeEnvironment(environmentId);
  }

  _handleShowEnvironmentModal() {
    showModal(WorkspaceEnvironmentsEditModal, this.props.workspace);
  }

  _setDropdownRef(n: Dropdown) {
    this._dropdown = n;
  }

  renderEnvironmentItem(environment: Environment) {
    return (
      <DropdownItem
        key={environment._id}
        value={environment._id}
        onClick={this._handleActivateEnvironment}
      >
        <i
          className="fa fa-random"
          style={{
            // @ts-expect-error -- TSCONVERSION don't set color if undefined
            color: environment.color,
          }}
        />
        Use <strong>{environment.name}</strong>
      </DropdownItem>
    );
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
      <Dropdown
        filterVisible
        ref={this._setDropdownRef}
        {...(other as Record<string, any>)}
        className={className}
      >
        <DropdownButton className="btn btn--super-compact no-wrap">
          <div className="sidebar__menu__thing">
            {!activeEnvironment && subEnvironments.length > 0 && (
              <Tooltip
                message="No environments active. Please select one to use."
                className="space-right"
                position="right"
              >
                <i className="fa fa-exclamation-triangle notice" />
              </Tooltip>
            )}
            <div className="sidebar__menu__thing__text">
              {activeEnvironment?.color && environmentHighlightColorStyle === 'sidebar-indicator' ? (
                <i
                  className="fa fa-circle space-right"
                  style={{
                    color: activeEnvironment.color,
                  }}
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
    );
  }
}

export const EnvironmentsDropdown: FunctionComponent<Props> = props => {
  /**
   * TODO: refactor the original component into functional component to avoid imperative control of the component.
   * */
  const ref = useRef<EnvironmentsDropdownOriginal>(null);

  useHotKeyEffect(() => {
    ref.current?._dropdown?.toggle(true);
  }, hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU.id);

  return <EnvironmentsDropdownOriginal ref={ref} {...props} />;
};
