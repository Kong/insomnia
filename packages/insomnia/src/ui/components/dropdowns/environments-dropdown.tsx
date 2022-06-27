import { EnvironmentHighlightColorStyle, HotKeyRegistry } from 'insomnia-common';
import React, { useRef } from 'react';

import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import type { Environment } from '../../../models/environment';
import type { Workspace } from '../../../models/workspace';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownHint } from '../base/dropdown/dropdown-hint';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { KeydownBinder } from '../keydown-binder';
import { showModal } from '../modals/index';
import { WorkspaceEnvironmentsEditModal } from '../modals/workspace-environments-edit-modal';
import { Tooltip } from '../tooltip';

interface Props {
  activeEnvironment?: Environment | null;
  className?: string;
  environmentHighlightColorStyle: EnvironmentHighlightColorStyle;
  environments: Environment[];
  handleChangeEnvironment: Function;
  hotKeyRegistry: HotKeyRegistry;
  workspace: Workspace;
}
export const EnvironmentsDropdown: React.FC<Props> = ({
  activeEnvironment,
  className,
  environmentHighlightColorStyle,
  environments,
  handleChangeEnvironment,
  hotKeyRegistry,
  workspace,
  ...dropdownProps
}) => {
  const dropdownRef = useRef<Dropdown>(null);
  const _handleShowEnvironmentModal = () => {
    showModal(WorkspaceEnvironmentsEditModal, workspace);
  };
  const _handleKeydown = (event: KeyboardEvent) => {
    executeHotKey(event, hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU, () => {
      dropdownRef.current?.toggle(true);
    });
  };
  // NOTE: Base environment might not exist if the users hasn't managed environments yet.
  const baseEnvironment = environments.find(environment => environment.parentId === workspace._id);
  const subEnvironments = environments
    .filter(environment => environment.parentId === (baseEnvironment && baseEnvironment._id))
    .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);
  const description =  (!activeEnvironment || activeEnvironment === baseEnvironment) ? 'No Environment' : activeEnvironment.name;

  return (
    <KeydownBinder onKeydown={_handleKeydown}>
      <Dropdown
        ref={dropdownRef}
        {...(dropdownProps as Record<string, any>)}
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
        {subEnvironments.map(environment => (
          <DropdownItem
            key={environment._id}
            value={environment._id}
            onClick={handleChangeEnvironment}
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
        ))}

        <DropdownItem onClick={handleChangeEnvironment}>
          <i className="fa fa-empty" /> No Environment
        </DropdownItem>

        <DropdownDivider>General</DropdownDivider>

        <DropdownItem onClick={_handleShowEnvironmentModal}>
          <i className="fa fa-wrench" /> Manage Environments
          <DropdownHint keyBindings={hotKeyRegistry[hotKeyRefs.ENVIRONMENT_SHOW_EDITOR.id]} />
        </DropdownItem>
      </Dropdown>
    </KeydownBinder>
  );
};
