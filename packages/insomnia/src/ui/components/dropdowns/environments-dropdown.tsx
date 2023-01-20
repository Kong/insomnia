import React, { FC, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import { selectActiveWorkspaceMeta, selectEnvironments, selectHotKeyRegistry } from '../../redux/selectors';
import { type DropdownHandle, Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { showModal } from '../modals/index';
import { WorkspaceEnvironmentsEditModal } from '../modals/workspace-environments-edit-modal';
import { Tooltip } from '../tooltip';

interface Props {
  activeEnvironment?: Environment | null;
  workspaceId: string;
}

export const EnvironmentsDropdown: FC<Props> = ({
  activeEnvironment,
  workspaceId,
}) => {
  const environments = useSelector(selectEnvironments);
  const hotKeyRegistry = useSelector(selectHotKeyRegistry);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const dropdownRef = useRef<DropdownHandle>(null);

  const toggleSwitchMenu = useCallback(() => {
    dropdownRef.current?.toggle(true);
  }, []);

  useDocBodyKeyboardShortcuts({
    environment_showSwitchMenu: toggleSwitchMenu,
  });

  // NOTE: Base environment might not exist if the users hasn't managed environments yet.
  const baseEnvironment = environments.find(environment => environment.parentId === workspaceId);
  const subEnvironments = environments
    .filter(environment => environment.parentId === (baseEnvironment && baseEnvironment._id))
    .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);
  const description = (!activeEnvironment || activeEnvironment === baseEnvironment) ? 'No Environment' : activeEnvironment.name;

  return (
    <Dropdown
      ref={dropdownRef}
      triggerButton={
        <DropdownButton
          className="btn btn--super-compact no-wrap"
          disableHoverBehavior={false}
        >
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
              {activeEnvironment?.color && (
                <i
                  className="fa fa-circle space-right"
                  style={{
                    color: activeEnvironment.color,
                  }}
                />
              )}
              {description}
            </div>
            <i className="space-left fa fa-caret-down" />
          </div>
        </DropdownButton>
      }
    >
      <DropdownSection title="Activate Environment">
        {subEnvironments.map(environment => (
          <DropdownItem key={environment._id}>
            <ItemContent
              icon="random"
              label={<span>Use <strong>{environment.name}</strong></span>}
              iconStyle={{
                ...(environment.color ? { color: environment.color } : {}),
              }}
              onClick={() => {
                if (activeWorkspaceMeta) {
                  models.workspaceMeta.update(activeWorkspaceMeta, { activeEnvironmentId: environment._id });
                }
              }}
            />
          </DropdownItem>
        ))}
      </DropdownSection>

      <DropdownItem>
        <ItemContent
          icon="empty"
          label="No Environment"
          onClick={() => {
            if (activeWorkspaceMeta) {
              models.workspaceMeta.update(activeWorkspaceMeta, { activeEnvironmentId: null });
            }
          }}
        />
      </DropdownItem>

      <DropdownSection title="General">
        <DropdownItem>
          <ItemContent
            icon="wrench"
            label="Manage Environments"
            hint={hotKeyRegistry.environment_showEditor}
            onClick={() => showModal(WorkspaceEnvironmentsEditModal)}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
