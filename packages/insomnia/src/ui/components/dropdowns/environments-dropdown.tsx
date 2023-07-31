import React, { FC, useRef, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { type Environment } from '../../../models/environment';
import { OrganizationLoaderData } from '../../routes/organization';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, type DropdownHandle, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { useDocBodyKeyboardShortcuts } from '../keydown-binder';
import { Tooltip } from '../tooltip';

interface Props {
  activeEnvironment?: Environment | null;
  workspaceId: string;
  setEnvironmentModalOpen: (isOpen: boolean) => void;
}

export const EnvironmentsDropdown: FC<Props> = ({ setEnvironmentModalOpen }) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const {
    baseEnvironment,
    activeEnvironment,
    subEnvironments,
  } = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;
  const {
    settings,
  } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { hotKeyRegistry } = settings;
  const setActiveEnvironmentFetcher = useFetcher();
  const dropdownRef = useRef<DropdownHandle>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useDocBodyKeyboardShortcuts({
    environment_showSwitchMenu: () => setIsDropdownOpen(true),
  });

  // NOTE: Base environment might not exist if the users hasn't managed environments yet.
  const description = (!activeEnvironment || activeEnvironment === baseEnvironment) ? 'No Environment' : activeEnvironment.name;

  return (
    <Dropdown
      ref={dropdownRef}
      isOpen={isDropdownOpen}
      onOpen={() => setIsDropdownOpen(true)}
      onClose={() => setIsDropdownOpen(false)}
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
                setActiveEnvironmentFetcher.submit({
                  environmentId: environment._id,
                },
                  {
                    method: 'post',
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                  });
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
            setActiveEnvironmentFetcher.submit({
              environmentId: baseEnvironment._id,
            },
              {
                method: 'post',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
              });
          }}
        />
      </DropdownItem>

      <DropdownSection title="General">
        <DropdownItem>
          <ItemContent icon="wrench" label="Manage Environments" hint={hotKeyRegistry.environment_showEditor} onClick={() => setEnvironmentModalOpen(true)} />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};
