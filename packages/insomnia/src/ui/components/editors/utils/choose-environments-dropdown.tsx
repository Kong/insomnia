import React, { FC, useRef } from 'react';
import styled from 'styled-components';

import { HotKeyRegistry } from '../../../../common/settings';
import { Environment } from '../../../../models/environment';
import { Workspace } from '../../../../models/workspace';
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
} from '../../base/dropdown';
import { Tooltip } from '../../tooltip';

const StyledDropdownContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;

  & > .dropdown__text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  i.fa {
    // Bump the drop down caret down a bit
    position: relative;
    top: 1px;
  }
`;

interface Props {
  handleChangeEnvironment: Function;
  workspace: Workspace;
  environments: Environment[];
  hotKeyRegistry: HotKeyRegistry;
  className?: string;
  activeEnvironment?: Environment | null;
}

export const ChooseEnvironmentsDropdown: FC<Props> = ({
  handleChangeEnvironment,
  workspace,
  environments,
  className,
  activeEnvironment,
}) => {
  const dropdownRef = useRef<typeof Dropdown>(null);

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

  const handleActivateEnvironment = (environmentId: string) => {
    handleChangeEnvironment(environmentId);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    executeHotKey(e, hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU, () => {
      dropdownRef.current?.toggle(true);
    });
  };

  const renderEnvironmentItem = (environment: Environment) => {
    return (
      <DropdownItem
        key={environment._id}
        textValue={environment._id}
        onClick={handleActivateEnvironment}
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
  };

  return (
    // <KeydownBinder onKeydown={handleKeydown}>
    <Dropdown
      ref={dropdownRef}
      // {...(other as Record<string, any>)}
      className={className}
    >
      <DropdownButton className="btn btn--super-compact no-wrap">
        <StyledDropdownContainer>
          {!activeEnvironment && subEnvironments.length > 0 && (
            <Tooltip
              message="No environments active. Please select one to use."
              className="space-right"
              position="right"
            >
              <i className="fa fa-exclamation-triangle notice" />
            </Tooltip>
          )}
          <div className="dropdown__text">
            {/* {activeEnvironment?.color &&
            environmentHighlightColorStyle === 'sidebar-indicator' ? (
              <i
                className="fa fa-tags space-right"
                style={{
                  color: activeEnvironment.color,
                }}
              />
            ) : null} */}
            {description}
          </div>
          <i className="space-left fa fa-caret-down" />
        </StyledDropdownContainer>
      </DropdownButton>

      <DropdownDivider>Activate Environment</DropdownDivider>
      {subEnvironments.map(renderEnvironmentItem)}

      <DropdownItem textValue="" onClick={handleActivateEnvironment}>
        <i className="fa fa-empty" /> No Environment
      </DropdownItem>
    </Dropdown>
    // </KeydownBinder>
  );
};
